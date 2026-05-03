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

      <Route component={NotFoundPage} />
    </Switch>
  );
}
