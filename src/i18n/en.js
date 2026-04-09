// English locale
// Note: email addresses in placeholder strings use {'@'} to escape the '@' sign,
// which would otherwise be parsed as a linked-message reference by vue-i18n.
export default {
  // Language switcher
  lang: {
    it: 'Italiano',
    en: 'English',
  },

  // Login page
  login: {
    tagline: 'alias-based email sender',
    desc: 'Send emails from your Cloudflare aliases.\nSign in with your Pocket ID account.',
    button: 'Sign in with Pocket ID \u2192',
  },

  // Navigation
  nav: {
    compose: 'Compose',
    aliases: 'Aliases',
    logout: 'Logout',
  },

  // Compose view
  compose: {
    title: 'Compose',
    subtitle: 'send a new email via alias',
    from: 'From (alias)',
    fromPlaceholder: 'Search alias\u2026',
    to: 'To',
    toPlaceholder: "recipient{'@'}example.com",
    replyTo: 'Reply-To',
    replyToOptional: '(optional)',
    replyToPlaceholder: 'defaults to alias if empty',
    subject: 'Subject',
    subjectPlaceholder: 'Message subject',
    body: 'Message',
    bodyPlaceholder: 'Write your message\u2026',
    attachments: 'Attachments',
    attachmentsHint: '(PDF, ZIP, images \u2014 10 MB total max)',
    dropZone: 'Drag files here or click to select',
    dropZoneAdd: '+ add more files',
    removeAttachment: 'Remove',
    sizeLimitWarning: '\u26a0 Total size: {size} \u2014 may be rejected by some servers',
    chars: '{n} chars',
    attachmentCount: '{n} attachment',
    attachmentCountPlural: '{n} attachments',
    clearBtn: 'Clear',
    sendBtn: 'Send \u2192',
    noAlias: 'No alias found',
    sendSuccess: 'Email sent',
    sendSuccessAttachments: 'Email sent with {n} attachment',
    sendSuccessAttachmentsPlural: 'Email sent with {n} attachments',
    sendError: 'Error while sending',
  },

  // Aliases view
  aliases: {
    title: 'Aliases',
    subtitle: '{filtered} of {total} aliases',
    newBtn: '+ New',
    closeBtn: '\u2715',
    aliasLabel: 'Alias',
    aliasPlaceholder: 'info',
    destinationLabel: 'Destination',
    destinationPlaceholder: "your{'@'}email.com",
    createBtn: 'Create alias',
    searchPlaceholder: 'Search alias or destination\u2026',
    statusHeader: 'Status',
    enabled: 'active',
    disabled: 'off',
    deleteTitle: 'Delete',
    noAliases: 'No aliases configured',
    noResults: 'No results for \u201c{q}\u201d',
    deleteConfirmTitle: 'Delete {alias}?',
    deleteConfirmBody: 'This action cannot be undone.',
    cancelBtn: 'Cancel',
    deleteBtn: 'Delete',
    createSuccess: 'Alias created',
    createError: 'Error creating alias',
    deleteSuccess: 'Alias deleted',
    deleteError: 'Error deleting alias',
    toggleError: 'Toggle error',
    updateSuccess: 'Destination updated',
    updateError: 'Error updating destination',
    invalidEmail: 'Please enter a valid email address',
  },
}