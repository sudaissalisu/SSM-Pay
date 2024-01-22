
export type Zainbox = {
  name: string;
  codeName: string;
  callbackUrl: string;
  emailNotification: string | null;
  description: string | null;
  tags: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  autoInternalTransfer: boolean;
};

export type ZainboxCreationResponse = {
  code: string;
  description: string;
  data: Zainbox;
}

export type TransactionStatus =
  | "Pending"
  | "Successful"
  | "Failed"
  | "Reversed";

export type VerifiedTransaction = {
  transactionRef: string;
  source: string;
  destination: string;
  amount: string;
  fee: string;
  status: TransactionStatus;
  rrn: string | null;
  narration: string;
  paymentMethod: string;
  zainboxCode: string;
  sessionId: string;
  settled: boolean;
  settlementAmount: string;
  createdAt: string;
};

export type ExchangeRatePartner = {
  name: string;
  code: string;
  currencyCode: 'NGN' | 'USD';
  buy: number;
  sell: number;
};

export type ExchangeRateResponse = {
  code: string;
  description: string;
  data: ExchangeRatePartner[];
}
