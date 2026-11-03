export type TLVNode = {
  tag: string;
  length: number;
  value: string;
  children?: TLVNode[];
};

export type ParsedQris = {
  root: TLVNode[];
  getTag(tag: string): TLVNode | undefined;
  getTagValue(tag: string): string | undefined;
  find(tag: string): TLVNode[];
};

export type DecodedQris = {
  merchantName?: string;
  merchantCity?: string;
  postalCode?: string;
  country?: string;
  acquirer?: string;
  acquirerGui?: string;
  merchantIdentifier1?: string;
  merchantIdentifier2?: string;
  merchantType?: string;
  qrisNetworkGui?: string;
  qrisNetworkId?: string;
  mcc?: string;
  mccDescription?: string;
  terminalLabel?: string;
  qrisType?: string;
  currency?: string;
  pointOfInitiation?: string;
  amount?: string;
  currencyCode?: string;
  crc: {
    provided: string;
    calculated: string;
    valid: boolean;
  };
  raw: string;
};

export type QrisFinding = { status: "valid" | "warning" | "invalid" | "unknown"; title: string; explanation: string; basis: string; limitation: string };
