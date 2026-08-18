/** Official TUMBU public contact — SSOT for UI copy (no SMTP). */

export const TUMBU_CONTACT = {
  legalName: 'TUMBU Business Operating System',
  email: 'halo@tumbu.web.id',
  phone: '+62 897-5196-393',
  phoneTel: '+628975196393',
  addressLines: [
    'Parung, Kabupaten Bogor,',
    'Jawa Barat 16330,',
    'Indonesia',
  ] as const,
  /** Short location for compact footers / sidebars */
  locationShort: 'Parung, Kabupaten Bogor',
} as const;

export const TUMBU_MAILTO = `mailto:${TUMBU_CONTACT.email}`;
export const TUMBU_TEL = `tel:${TUMBU_CONTACT.phoneTel}`;
