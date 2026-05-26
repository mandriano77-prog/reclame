(function (global) {
  'use strict';

  const { createEl } = global.A2W.UI.utils;

  /**
   * @param {{ label: string, dialog: { title: string, description?: string, impactedItems?: string[], requireTyping?: boolean, confirmText?: string, confirmLabel?: string, onConfirm: () => void|Promise<void> } }} props
   */
  function createDangerActionButton(props) {
    props = props || {};
    const btn = createEl('button', 'btn a2w-ui-btn-destructive', {
      type: 'button',
      text: props.label || 'Elimina',
      'data-a2w-component': 'danger-action-button'
    });

    btn.addEventListener('click', async function () {
      const dlg = props.dialog || {};
      const ok = await global.A2W.UI.openConfirmDialog({
        title: dlg.title,
        description: dlg.description,
        impactedItems: dlg.impactedItems,
        requireTyping: dlg.requireTyping,
        confirmText: dlg.confirmText,
        confirmLabel: dlg.confirmLabel || 'Elimina'
      });
      if (ok && typeof dlg.onConfirm === 'function') await dlg.onConfirm();
    });

    return btn;
  }

  global.A2W.UI.createDangerActionButton = createDangerActionButton;
})((typeof window !== 'undefined' ? window : global));
