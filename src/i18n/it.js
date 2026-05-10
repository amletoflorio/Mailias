// Italian locale
// Note: plain apostrophes (') in message strings must use the Unicode right
// single quotation mark (U+2019 = \u2019) because vue-i18n's message compiler
// treats the ASCII apostrophe as a special escape character.
// Email addresses inside placeholder strings use {'@'} to escape the '@' sign,
// which would otherwise be parsed as a linked-message reference.
export default {
  // Language switcher
  lang: {
    it: 'Italiano',
    en: 'English',
  },

  // Login page
  login: {
    tagline: 'alias-based email sender',
    desc: 'Invia email dai tuoi alias Cloudflare.\nAccedi con il tuo account Pocket ID.',
    button: 'Accedi con Pocket ID \u2192',
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
    subtitle: 'invia una nuova email tramite alias',
    from: 'Da (alias)',
    fromPlaceholder: 'Cerca alias\u2026',
    to: 'A',
    toPlaceholder: "destinatario{'@'}esempio.com",
    replyTo: 'Reply-To',
    replyToOptional: '(opzionale)',
    replyToPlaceholder: 'stessa dell\u2019alias se vuoto',
    subject: 'Oggetto',
    subjectPlaceholder: 'Oggetto del messaggio',
    body: 'Messaggio',
    bodyPlaceholder: 'Scrivi il tuo messaggio\u2026',
    attachments: 'Allegati',
    attachmentsHint: '(PDF, ZIP, immagini \u2014 max 10 MB totali)',
    dropZone: 'Trascina file qui oppure clicca per selezionare',
    dropZoneAdd: '+ aggiungi altri file',
    removeAttachment: 'Rimuovi',
    sizeLimitWarning: '\u26a0 Dimensione totale: {size} \u2014 potrebbe essere rifiutata da alcuni server',
    chars: '{n} car.',
    attachmentCount: '{n} allegato',
    attachmentCountPlural: '{n} allegati',
    clearBtn: 'Pulisci',
    sendBtn: 'Invia \u2192',
    noAlias: 'Nessun alias trovato',
    sendSuccess: 'Email inviata',
    sendSuccessAttachments: 'Email inviata con {n} allegato',
    sendSuccessAttachmentsPlural: 'Email inviata con {n} allegati',
    sendError: 'Errore durante l\u2019invio',
  },

  // Aliases view
  aliases: {
    title: 'Aliases',
    subtitle: '{filtered} di {total} alias',
    newBtn: '+ Nuovo',
    closeBtn: '\u2715',
    aliasLabel: 'Alias',
    aliasPlaceholder: 'info',
    destinationLabel: 'Destinazione',
    destinationPlaceholder: "tua{'@'}email.com",
    createBtn: 'Crea alias',
    searchPlaceholder: 'Cerca alias o destinazione\u2026',
    statusHeader: 'Stato',
    enabled: 'attivo',
    disabled: 'off',
    deleteTitle: 'Elimina',
    noAliases: 'Nessun alias configurato',
    noResults: 'Nessun risultato per \u201c{q}\u201d',
    deleteConfirmTitle: 'Eliminare {alias}?',
    deleteConfirmBody: 'L\u2019operazione \u00e8 irreversibile.',
    cancelBtn: 'Annulla',
    deleteBtn: 'Elimina',
    createSuccess: 'Alias creato',
    createError: 'Errore nella creazione',
    deleteSuccess: 'Alias eliminato',
    deleteError: 'Errore nell\u2019eliminazione',
    toggleError: 'Errore nel toggle',
    updateSuccess: 'Destinazione aggiornata',
    updateError: 'Errore nell\u2019aggiornamento',
    invalidEmail: 'Inserisci un indirizzo email valido',
  },
}