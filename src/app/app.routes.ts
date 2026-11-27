
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
    {
        path: 'login',
        loadComponent: () => import('./features/auth/login.component')
            .then(m => m.LoginComponent)
    },
    {
        path: '',
        canActivate: [authGuard],
        loadComponent: () => import('./features/dashboard/dashboard.component')
            .then(m => m.DashboardComponent)
    },
    {
        path: 'moviments',
        canActivate: [authGuard],
        loadComponent: () => import('./features/transactions/transactions.component')
            .then(m => m.TransactionsComponent)
    },
    {
        path: 'comptes',
        canActivate: [authGuard],
        loadComponent: () => import('./features/accounts/accounts.component')
            .then(m => m.AccountsComponent)
    },
    {
        path: 'categories',
        canActivate: [authGuard],
        loadComponent: () => import('./features/categories/categories.component')
            .then(m => m.CategoriesComponent)
    },
    {
        path: 'recurrents',
        canActivate: [authGuard],
        loadComponent: () => import('./features/recurring/recurring.component')
            .then(m => m.RecurringComponent)
    },
    {
        path: 'pressupostos',
        canActivate: [authGuard],
        loadComponent: () => import('./features/budgets/budgets.component')
            .then(m => m.BudgetsComponent)
    },
    {
        path: 'objectius',
        canActivate: [authGuard],
        loadComponent: () => import('./features/savings/savings.component')
            .then(m => m.SavingsComponent)
    },
    {
        path: 'mes',
        canActivate: [authGuard],
        loadComponent: () => import('./features/more/more.component')
            .then(m => m.MoreComponent)
    },
    {
        path: 'copies',
        canActivate: [authGuard],
        loadComponent: () =>
            import('./features/backups/backups.component')
                .then(m => m.BackupsComponent)
    },
    {
        path: '**',
        redirectTo: ''
    }
];
