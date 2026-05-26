/**
 * Ads2Wallet dashboard UI — TypeScript contracts.
 * Runtime (vanilla DOM): src/dashboard/js/components/ui/
 * Playground: /dashboard/ui-playground.html
 */

export type BreadcrumbItem = { label: string; href?: string };

export type PageHeaderProps = {
  breadcrumb?: BreadcrumbItem[];
  title: string;
  description?: string;
  actions?: HTMLElement | HTMLElement[];
  status?: HTMLElement;
};

export type EmptyStateAction = { label: string; onClick: () => void };

export type EmptyStateProps = {
  icon?: HTMLElement | string;
  title: string;
  description?: string;
  primaryAction?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  tertiaryAction?: EmptyStateAction;
};

export type ErrorStateProps = {
  title: string;
  message: string;
  errorCode?: string;
  onRetry?: () => void;
};

export type ToolbarProps = {
  left?: HTMLElement | HTMLElement[];
  right?: HTMLElement | HTMLElement[];
};

export type StatCardProps = {
  label: string;
  value: string | number;
  delta?: { value: string; direction: 'up' | 'down' | 'neutral' };
  icon?: HTMLElement | string;
  tone?: 'default' | 'primary';
  tooltip?: string;
};

export type ConfirmDialogProps = {
  title: string;
  description?: string;
  impactedItems?: string[];
  requireTyping?: boolean;
  confirmText?: string;
  confirmLabel?: string;
};

export type DangerActionButtonProps = {
  label: string;
  dialog: ConfirmDialogProps & { onConfirm: () => void | Promise<void> };
};

export type ActionMenuItem = {
  icon?: string;
  label: string;
  onClick: () => void;
  destructive?: boolean;
};

export type ActionMenuProps = {
  label?: string;
  items: ActionMenuItem[];
};

/** Runtime factories on window.A2W.UI (browser) */
export type A2wUiRuntime = {
  createPageHeader: (props: PageHeaderProps) => HTMLElement;
  createEmptyState: (props: EmptyStateProps) => HTMLElement;
  createErrorState: (props: ErrorStateProps) => HTMLElement;
  createToolbar: (props: ToolbarProps) => HTMLElement;
  createStatCard: (props: StatCardProps) => HTMLElement;
  createDangerActionButton: (props: DangerActionButtonProps) => HTMLButtonElement;
  createActionMenu: (props: ActionMenuProps) => HTMLElement;
  openConfirmDialog: (props: ConfirmDialogProps) => Promise<boolean>;
  isConfirmTypingMatch: (input: string, expected: string) => boolean;
};

declare global {
  interface Window {
    A2W?: { UI?: A2wUiRuntime };
  }
}

export {};
