import { lazy } from 'react';
import { Redirect, Route, Switch } from 'react-router-dom';

import { ProtectedRoute } from './components/ProtectedRoute';

const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const NotFoundPage = lazy(() =>
  import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
);
const UsersListPage = lazy(() =>
  import('./pages/admin/UsersListPage').then((m) => ({ default: m.UsersListPage })),
);
const UserDetailPage = lazy(() =>
  import('./pages/admin/UserDetailPage').then((m) => ({ default: m.UserDetailPage })),
);
const RolesListPage = lazy(() =>
  import('./pages/admin/RolesListPage').then((m) => ({ default: m.RolesListPage })),
);
const RoleFormPage = lazy(() =>
  import('./pages/admin/RoleFormPage').then((m) => ({ default: m.RoleFormPage })),
);
const AccountPage = lazy(() =>
  import('./pages/AccountPage').then((m) => ({ default: m.AccountPage })),
);

// Phase 3 — Customers
const CustomersListPage = lazy(() =>
  import('./pages/customers/CustomersListPage').then((m) => ({ default: m.CustomersListPage })),
);
const CustomerDetailPage = lazy(() =>
  import('./pages/customers/CustomerDetailPage').then((m) => ({ default: m.CustomerDetailPage })),
);
const NewCustomerPage = lazy(() =>
  import('./pages/customers/NewCustomerPage').then((m) => ({ default: m.NewCustomerPage })),
);
const EditCustomerPage = lazy(() =>
  import('./pages/customers/EditCustomerPage').then((m) => ({ default: m.EditCustomerPage })),
);
const CustomerStatementPage = lazy(() =>
  import('./pages/customers/CustomerStatementPage').then((m) => ({
    default: m.CustomerStatementPage,
  })),
);
const NotificationsPage = lazy(() =>
  import('./pages/notifications/NotificationsPage').then((m) => ({ default: m.NotificationsPage })),
);

// Phase 4 — Suppliers
const SuppliersListPage = lazy(() =>
  import('./pages/suppliers/SuppliersListPage').then((m) => ({ default: m.SuppliersListPage })),
);
const NewSupplierPage = lazy(() =>
  import('./pages/suppliers/NewSupplierPage').then((m) => ({ default: m.NewSupplierPage })),
);
const EditSupplierPage = lazy(() =>
  import('./pages/suppliers/EditSupplierPage').then((m) => ({ default: m.EditSupplierPage })),
);
const SupplierDetailPage = lazy(() =>
  import('./pages/suppliers/SupplierDetailPage').then((m) => ({ default: m.SupplierDetailPage })),
);
const SupplierStatementPage = lazy(() =>
  import('./pages/suppliers/SupplierStatementPage').then((m) => ({
    default: m.SupplierStatementPage,
  })),
);

// Phase 4 — Purchases
const PurchasesListPage = lazy(() =>
  import('./pages/purchases/PurchasesListPage').then((m) => ({ default: m.PurchasesListPage })),
);
const NewPurchasePage = lazy(() =>
  import('./pages/purchases/NewPurchasePage').then((m) => ({ default: m.NewPurchasePage })),
);
const PurchaseDetailPage = lazy(() =>
  import('./pages/purchases/PurchaseDetailPage').then((m) => ({ default: m.PurchaseDetailPage })),
);

// Phase 5 — Expenses + Daily Income
const ExpensesListPage = lazy(() =>
  import('./pages/expenses/ExpensesListPage').then((m) => ({ default: m.ExpensesListPage })),
);
const NewExpensePage = lazy(() =>
  import('./pages/expenses/NewExpensePage').then((m) => ({ default: m.NewExpensePage })),
);
const ExpenseDetailPage = lazy(() =>
  import('./pages/expenses/ExpenseDetailPage').then((m) => ({ default: m.ExpenseDetailPage })),
);
const ExpenseCategoriesPage = lazy(() =>
  import('./pages/expenses/ExpenseCategoriesPage').then((m) => ({
    default: m.ExpenseCategoriesPage,
  })),
);
const DailyIncomeTodayPage = lazy(() =>
  import('./pages/daily-income/DailyIncomeTodayPage').then((m) => ({
    default: m.DailyIncomeTodayPage,
  })),
);
const DailyIncomeHistoryPage = lazy(() =>
  import('./pages/daily-income/DailyIncomeHistoryPage').then((m) => ({
    default: m.DailyIncomeHistoryPage,
  })),
);
const DailyIncomeByDatePage = lazy(() =>
  import('./pages/daily-income/DailyIncomeByDatePage').then((m) => ({
    default: m.DailyIncomeByDatePage,
  })),
);

// Phase 6 — Sales
const SalesListPage = lazy(() =>
  import('./pages/sales/SalesListPage').then((m) => ({ default: m.SalesListPage })),
);
const NewSalePage = lazy(() =>
  import('./pages/sales/NewSalePage').then((m) => ({ default: m.NewSalePage })),
);
const SaleDetailPage = lazy(() =>
  import('./pages/sales/SaleDetailPage').then((m) => ({ default: m.SaleDetailPage })),
);

/**
 * Application routes (React Router v5 — Q4 keeps v5 due to Ionic 8 lock).
 *
 *   /                      → redirect to /login
 *   /login                 → LoginPage (public)
 *   /dashboard             → DashboardPage (auth required)
 *   /admin/users           → UsersListPage (auth + users.view)
 *   /admin/users/:id       → UserDetailPage (auth + users.view)
 *   /admin/roles           → RolesListPage (auth + roles.view)
 *   /admin/roles/new       → RoleFormPage create (auth + roles.create)
 *   /admin/roles/:id       → RoleFormPage edit (auth + roles.update)
 *   /account               → AccountPage (auth)
 *   *                      → NotFoundPage (404)
 */
export function AppRoutes(): JSX.Element {
  return (
    <Switch>
      <Route exact path="/" render={() => <Redirect to="/login" />} />
      <Route exact path="/login" component={LoginPage} />
      <ProtectedRoute exact path="/dashboard" component={DashboardPage} />

      {/* Admin */}
      <ProtectedRoute exact path="/admin/users" component={UsersListPage} permission="users.view" />
      <ProtectedRoute
        exact
        path="/admin/users/:id"
        component={UserDetailPage}
        permission="users.view"
      />
      <ProtectedRoute exact path="/admin/roles" component={RolesListPage} permission="roles.view" />
      <ProtectedRoute
        exact
        path="/admin/roles/new"
        component={RoleFormPage}
        permission="roles.create"
      />
      <ProtectedRoute
        exact
        path="/admin/roles/:id"
        component={RoleFormPage}
        permission="roles.view"
      />

      {/* Account */}
      <ProtectedRoute exact path="/account" component={AccountPage} />

      {/* Phase 3 — Customers */}
      <ProtectedRoute
        exact
        path="/customers"
        component={CustomersListPage}
        permission="customers.view"
      />
      <ProtectedRoute
        exact
        path="/customers/new"
        component={NewCustomerPage}
        permission="customers.create"
      />
      <ProtectedRoute
        exact
        path="/customers/:id"
        component={CustomerDetailPage}
        permission="customers.view"
      />
      <ProtectedRoute
        exact
        path="/customers/:id/edit"
        component={EditCustomerPage}
        permission="customers.update"
      />
      <ProtectedRoute
        exact
        path="/customers/:id/statement"
        component={CustomerStatementPage}
        permission="customers.view_transactions"
      />

      {/* Phase 3 — Notifications */}
      <ProtectedRoute
        exact
        path="/notifications"
        component={NotificationsPage}
        permission="notifications.view_own"
      />

      {/* Phase 4 — Suppliers */}
      <ProtectedRoute
        exact
        path="/suppliers"
        component={SuppliersListPage}
        permission="suppliers.view"
      />
      <ProtectedRoute
        exact
        path="/suppliers/new"
        component={NewSupplierPage}
        permission="suppliers.create"
      />
      <ProtectedRoute
        exact
        path="/suppliers/:id"
        component={SupplierDetailPage}
        permission="suppliers.view"
      />
      <ProtectedRoute
        exact
        path="/suppliers/:id/edit"
        component={EditSupplierPage}
        permission="suppliers.update"
      />
      <ProtectedRoute
        exact
        path="/suppliers/:id/statement"
        component={SupplierStatementPage}
        permission="suppliers.view_transactions"
      />

      {/* Phase 4 — Purchases */}
      <ProtectedRoute
        exact
        path="/purchases"
        component={PurchasesListPage}
        permission="purchases.view"
      />
      <ProtectedRoute
        exact
        path="/purchases/new"
        component={NewPurchasePage}
        permission="purchases.create"
      />
      <ProtectedRoute
        exact
        path="/purchases/:id"
        component={PurchaseDetailPage}
        permission="purchases.view"
      />

      {/* Phase 5 — Expenses */}
      <ProtectedRoute
        exact
        path="/expenses"
        component={ExpensesListPage}
        permission="expenses.view"
      />
      <ProtectedRoute
        exact
        path="/expenses/categories"
        component={ExpenseCategoriesPage}
        permission="expense_categories.view"
      />
      <ProtectedRoute
        exact
        path="/expenses/new"
        component={NewExpensePage}
        permission="expenses.create"
      />
      <ProtectedRoute
        exact
        path="/expenses/:id"
        component={ExpenseDetailPage}
        permission="expenses.view"
      />

      {/* Phase 5 — Daily Income */}
      <ProtectedRoute
        exact
        path="/daily-income"
        component={DailyIncomeTodayPage}
        permission="daily_income.view"
      />
      <ProtectedRoute
        exact
        path="/daily-income/history"
        component={DailyIncomeHistoryPage}
        permission="daily_income.view"
      />
      <ProtectedRoute
        exact
        path="/daily-income/:date"
        component={DailyIncomeByDatePage}
        permission="daily_income.view"
      />

      {/* Phase 6 — Sales */}
      <ProtectedRoute exact path="/sales" component={SalesListPage} permission="sales.view" />
      <ProtectedRoute exact path="/sales/new" component={NewSalePage} permission="sales.create" />
      <ProtectedRoute exact path="/sales/:id" component={SaleDetailPage} permission="sales.view" />

      <Route component={NotFoundPage} />
    </Switch>
  );
}
