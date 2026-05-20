/**
 * SchedulerService — Phase 8 P8-4.
 *
 * Cron jobs:
 *   • 09:00 daily — customer monthly reminders (WhatsApp).
 *     Filters customers whose `currentBalance > 0` and matches their
 *     CustomerReminderSettings.frequency / day-of-month.
 *
 *   • 23:00 daily — customer behavior analysis.
 *     Creates CustomerBehaviorAlert rows for:
 *       - inactive customers (no debt/payment activity for N days)
 *       - aged debt (last DEBT > settings.debt_aging_warn_days ago)
 *       - near credit limit (balance >= 80% of credit limit)
 *
 *   • 03:00 weekly (Sunday) — purge expired idempotency + password reset rows.
 *
 * Each run inserts a `ScheduledJob` row so the dashboard / audit log can
 * inspect when it last ran and whether it succeeded.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { IdempotencyCleanerService } from '../../common/idempotency/idempotency-cleaner.service';
import { NotificationTemplatesService } from '../notification-templates/notification-templates.service';
import { PasswordResetsService } from '../password-resets/password-resets.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly templates: NotificationTemplatesService,
    private readonly passwordResets: PasswordResetsService,
    private readonly idempotency: IdempotencyCleanerService,
  ) {}

  private async runJob<T>(
    storeId: string,
    jobKey: string,
    work: () => Promise<T>,
  ): Promise<T | null> {
    const start = await this.prisma.scheduledJob.create({
      data: { storeId, jobKey, status: 'RUNNING' },
    });
    try {
      const result = await work();
      await this.prisma.scheduledJob.update({
        where: { id: start.id },
        data: {
          status: 'SUCCESS',
          finishedAt: new Date(),
          resultJson: result as unknown as object,
        },
      });
      this.logger.log(`[${jobKey}] success`);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.scheduledJob.update({
        where: { id: start.id },
        data: { status: 'FAILED', finishedAt: new Date(), error: message },
      });
      this.logger.error(`[${jobKey}] failed: ${message}`);
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────
  // 09:00 daily — customer monthly reminders
  // ─────────────────────────────────────────────────────────
  @Cron(CronExpression.EVERY_DAY_AT_9AM, { name: 'customer-monthly-reminders' })
  async customerMonthlyReminders() {
    const stores = await this.prisma.store.findMany({ select: { id: true } });
    for (const s of stores) {
      await this.runJob(s.id, 'customer_monthly_reminders', async () => {
        const today = new Date();
        const reminderDay = await this.settings.getValue<number>(
          s.id,
          'notifications.reminder_day',
          1,
        );
        if (today.getUTCDate() !== reminderDay) {
          return { skipped: true, reason: 'not-reminder-day' };
        }

        const customers = await this.prisma.customer.findMany({
          where: {
            storeId: s.id,
            deletedAt: null,
            currentBalance: { gt: 0 },
            reminderSettings: { enabled: true },
          },
          include: { reminderSettings: true },
        });

        await this.templates.ensureSystemTemplates(s.id, customers[0]?.createdById ?? '');
        const tpl = await this.prisma.notificationTemplate.findUnique({
          where: { storeId_key: { storeId: s.id, key: 'monthly_reminder' } },
        });
        const currency = await this.settings.getValue<string>(s.id, 'store.currency', 'YER');
        const storeName = await this.settings.getValue<string>(s.id, 'store.name', '');

        let sent = 0;
        for (const c of customers) {
          // Skip if last reminder less than 25 days ago.
          if (
            c.reminderSettings?.lastSentAt &&
            Date.now() - c.reminderSettings.lastSentAt.getTime() < 25 * 24 * 3600 * 1000
          ) {
            continue;
          }
          const body = tpl
            ? NotificationTemplatesService.render(tpl.bodyTemplate, {
                customer_name: c.name,
                balance: Number(c.currentBalance).toFixed(2),
                currency,
                store_name: storeName,
              })
            : `تذكير: مستحقاتك ${Number(c.currentBalance).toFixed(2)} ${currency}.`;

          await this.prisma.$transaction(async (db) => {
            await db.notification.create({
              data: {
                storeId: s.id,
                userId: null,
                type: 'CUSTOMER_DEBT_HIGH',
                title: 'تذكير شهري للعميل',
                body,
                metadata: { customerId: c.id, channel: 'WHATSAPP' },
              },
            });
            if (c.reminderSettings) {
              await db.customerReminderSettings.update({
                where: { customerId: c.id },
                data: { lastSentAt: new Date() },
              });
            }
          });
          sent += 1;
        }
        return { sent, total: customers.length };
      });
    }
  }

  // ─────────────────────────────────────────────────────────
  // 23:00 daily — customer behavior analysis
  // ─────────────────────────────────────────────────────────
  @Cron('0 23 * * *', { name: 'customer-behavior-analysis' })
  async customerBehaviorAnalysis() {
    const stores = await this.prisma.store.findMany({ select: { id: true } });
    for (const s of stores) {
      await this.runJob(s.id, 'customer_behavior_analysis', async () => {
        const inactiveDays = await this.settings.getValue<number>(
          s.id,
          'customers.inactive_threshold_days',
          30,
        );
        const debtAgingDays = await this.settings.getValue<number>(
          s.id,
          'customers.debt_aging_warn_days',
          60,
        );

        const now = new Date();
        const inactiveCutoff = new Date(now.getTime() - inactiveDays * 86_400_000);
        const debtCutoff = new Date(now.getTime() - debtAgingDays * 86_400_000);

        const customers = await this.prisma.customer.findMany({
          where: { storeId: s.id, deletedAt: null },
          include: {
            transactions: {
              where: { cancelledAt: null },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        });

        let inactiveCount = 0;
        let agedDebtCount = 0;
        let nearLimitCount = 0;

        for (const c of customers) {
          const lastActivity = c.transactions[0]?.createdAt ?? c.createdAt;
          const balance = Number(c.currentBalance);
          const creditLimit = c.creditLimit ? Number(c.creditLimit) : null;

          // 1) Inactive customer
          if (lastActivity < inactiveCutoff && balance === 0) {
            await this.prisma.customerBehaviorAlert.upsert({
              where: {
                storeId_customerId_alertType: {
                  storeId: s.id,
                  customerId: c.id,
                  alertType: 'inactive',
                },
              },
              update: { resolvedAt: null, message: `لم يتعامل منذ ${inactiveDays} يوم` },
              create: {
                storeId: s.id,
                customerId: c.id,
                alertType: 'inactive',
                severity: 'INFO',
                message: `لم يتعامل منذ ${inactiveDays} يوم`,
              },
            });
            inactiveCount++;
          }

          // 2) Aged debt
          if (balance > 0 && lastActivity < debtCutoff) {
            await this.prisma.customerBehaviorAlert.upsert({
              where: {
                storeId_customerId_alertType: {
                  storeId: s.id,
                  customerId: c.id,
                  alertType: 'aged_debt',
                },
              },
              update: { resolvedAt: null, message: `دين متأخر منذ ${debtAgingDays} يوم` },
              create: {
                storeId: s.id,
                customerId: c.id,
                alertType: 'aged_debt',
                severity: 'WARNING',
                message: `دين متأخر منذ ${debtAgingDays} يوم`,
              },
            });
            agedDebtCount++;
          }

          // 3) Near credit limit (≥80%)
          if (creditLimit && creditLimit > 0 && balance / creditLimit >= 0.8) {
            await this.prisma.customerBehaviorAlert.upsert({
              where: {
                storeId_customerId_alertType: {
                  storeId: s.id,
                  customerId: c.id,
                  alertType: 'near_limit',
                },
              },
              update: { resolvedAt: null, message: 'قريب من سقف الائتمان' },
              create: {
                storeId: s.id,
                customerId: c.id,
                alertType: 'near_limit',
                severity: 'CRITICAL',
                message: `قريب من سقف الائتمان (${((balance / creditLimit) * 100).toFixed(0)}%)`,
              },
            });
            nearLimitCount++;
          }
        }

        return { inactiveCount, agedDebtCount, nearLimitCount };
      });
    }
  }

  // ─────────────────────────────────────────────────────────
  // 03:00 weekly (Sunday) — purge expired records
  // ─────────────────────────────────────────────────────────
  @Cron('0 3 * * 0', { name: 'weekly-cleanup' })
  async weeklyCleanup() {
    const stores = await this.prisma.store.findMany({ select: { id: true } });
    for (const s of stores) {
      await this.runJob(s.id, 'weekly_cleanup', async () => {
        const idempotency = await this.idempotency.purgeExpired();
        const passwordResets = await this.passwordResets.purgeExpired();
        return { idempotency: idempotency.deleted, passwordResets };
      });
    }
  }

  // ─────────────────────────────────────────────────────────
  // Manual trigger — used by tests + admin "run now" buttons.
  // ─────────────────────────────────────────────────────────
  async runManually(jobKey: string) {
    switch (jobKey) {
      case 'customer_monthly_reminders':
        await this.customerMonthlyReminders();
        break;
      case 'customer_behavior_analysis':
        await this.customerBehaviorAnalysis();
        break;
      case 'weekly_cleanup':
        await this.weeklyCleanup();
        break;
      default:
        throw new Error(`unknown job: ${jobKey}`);
    }
    return { ok: true, job: jobKey };
  }

  async getJobHistory(storeId: string, jobKey?: string, limit = 50) {
    return this.prisma.scheduledJob.findMany({
      where: { storeId, ...(jobKey ? { jobKey } : {}) },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
  }
}
