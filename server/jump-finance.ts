/**
 * Jump.Finance API Client
 * https://apidoc.jump.finance/openapi-v1
 *
 * Handles: payouts (card/SBP), contractor management, identification, acts
 */

import { ENV } from "./_core/env";

// --- Types ---

export interface JumpContractor {
  id: number;
  phone: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  full_name: string;
  short_name: string;
  legal_form_id: number;
  tin?: string;
}

export interface JumpRequisite {
  id: number;
  type_id: number; // 8=card, 9=SBP, 10=bank_account, 11=card_uuid
  account_number?: string;
  masked_account?: string;
  is_default: boolean;
  icon?: string;
}

export interface JumpPaymentStatus {
  id: number; // 1=Paid, 2=Rejected, 3=Processing, 4=Awaiting, 5=Error, 6=Deleted, 7=AwaitingConfirm, 8=AwaitingSignature
  title: string;
}

export interface JumpPayment {
  id: string;
  amount: number;
  amount_paid?: number;
  commission?: number;
  commission_bank?: number;
  is_final: boolean;
  status: JumpPaymentStatus;
  contractor?: JumpContractor;
  customer_payment_id?: string;
  abilities?: {
    can_repeat: boolean;
    can_cancel: boolean;
    can_refund: boolean;
  };
}

export interface JumpIdentification {
  id: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface JumpAct {
  id: number;
  status: string;
}

interface JumpErrorResponse {
  error: {
    title: string;
    detail: string;
    fields?: Array<{ field: string; messages: string[] }>;
    code: number;
  };
}

export interface JumpListResponse<T> {
  items: T[];
  meta: {
    total: number;
    from: number;
    to: number;
    per_page: number;
    current_page: number;
    last_page: number;
  };
}

// Requisite type IDs
export const REQUISITE_TYPE = {
  CARD: 8,
  SBP: 9,
  BANK_ACCOUNT: 10,
  CARD_UUID: 11,
} as const;

// Legal form IDs
export const LEGAL_FORM = {
  INDIVIDUAL: 1,      // Физлицо
  SELF_EMPLOYED: 2,    // Самозанятый
  IP: 3,               // ИП
} as const;

// Payment status IDs
export const JUMP_STATUS = {
  PAID: 1,
  REJECTED: 2,
  PROCESSING: 3,
  AWAITING_PAYMENT: 4,
  ERROR: 5,
  DELETED: 6,
  AWAITING_CONFIRMATION: 7,
  AWAITING_SIGNATURE: 8,
} as const;

// --- API Client ---

class JumpFinanceError extends Error {
  constructor(
    public statusCode: number,
    public errorBody: JumpErrorResponse | null,
    message: string
  ) {
    super(message);
    this.name = "JumpFinanceError";
  }
}

class JumpFinanceClient {
  private baseUrl = "https://api.jump.finance/services/openapi";
  private apiKey: string;
  private agentId: string;
  private bankAccountId: string;

  constructor() {
    this.apiKey = ENV.jumpFinanceApiKey;
    this.agentId = ENV.jumpFinanceAgentId;
    this.bankAccountId = ENV.jumpFinanceBankAccountId;
  }

  get isConfigured(): boolean {
    return !!this.apiKey;
  }

  // --- HTTP helpers ---

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string | number>
  ): Promise<T> {
    if (!this.apiKey) {
      throw new JumpFinanceError(0, null, "Jump.Finance API key not configured");
    }

    let url = `${this.baseUrl}${path}`;
    if (query) {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null) params.set(k, String(v));
      }
      const qs = params.toString();
      if (qs) url += `?${qs}`;
    }

    const headers: Record<string, string> = {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Client-Key": this.apiKey,
    };

    const opts: RequestInit = { method, headers };
    if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
      opts.body = JSON.stringify(body);
    }

    console.log(`[Jump.Finance] ${method} ${path}`, body ? JSON.stringify(body).slice(0, 200) : "");

    const res = await fetch(url, opts);

    if (!res.ok) {
      let errorBody: JumpErrorResponse | null = null;
      try {
        errorBody = await res.json() as JumpErrorResponse;
      } catch { /* ignore parse errors */ }

      const detail = errorBody?.error?.detail || res.statusText;
      console.error(`[Jump.Finance] Error ${res.status}: ${detail}`, errorBody?.error?.fields);
      throw new JumpFinanceError(res.status, errorBody, `Jump.Finance API error ${res.status}: ${detail}`);
    }

    // Some endpoints return 204 No Content
    if (res.status === 204) return {} as T;

    return await res.json() as T;
  }

  private get<T>(path: string, query?: Record<string, string | number>) {
    return this.request<T>("GET", path, undefined, query);
  }

  private post<T>(path: string, body?: unknown) {
    return this.request<T>("POST", path, body);
  }

  private put<T>(path: string, body?: unknown) {
    return this.request<T>("PUT", path, body);
  }

  private patch<T>(path: string, body?: unknown) {
    return this.request<T>("PATCH", path, body);
  }

  private delete<T>(path: string) {
    return this.request<T>("DELETE", path);
  }

  // --- Contractors ---

  async createContractor(params: {
    phone: string;
    firstName: string;
    lastName: string;
    middleName?: string;
    legalFormId: number; // 1=individual, 2=self-employed, 3=IP
    tin?: string; // INN
  }): Promise<{ item: JumpContractor }> {
    return this.post("/contractors", {
      phone: params.phone,
      first_name: params.firstName,
      last_name: params.lastName,
      middle_name: params.middleName,
      legal_form_id: params.legalFormId,
      tin: params.tin,
    });
  }

  async getContractor(id: number): Promise<{ item: JumpContractor }> {
    return this.get(`/contractors/${id}`);
  }

  async listContractors(page = 1, perPage = 20): Promise<JumpListResponse<JumpContractor>> {
    return this.get("/contractors", { page, per_page: perPage });
  }

  async deleteContractor(id: number): Promise<void> {
    await this.delete(`/contractors/${id}`);
  }

  // --- Requisites ---

  async addRequisite(
    contractorId: number,
    typeId: number, // 8=card, 9=SBP, 10=bank_account
    accountNumber?: string, // card number or bank account
    sbpBankId?: number // required for SBP
  ): Promise<{ item: JumpRequisite }> {
    const body: Record<string, unknown> = { type_id: typeId };
    if (accountNumber) body.account_number = accountNumber;
    if (sbpBankId) body.sbp_bank_id = sbpBankId;
    return this.post(`/contractors/${contractorId}/requisites`, body);
  }

  async getRequisites(contractorId: number): Promise<{ items: JumpRequisite[] }> {
    return this.get(`/contractors/${contractorId}/requisites`);
  }

  async setDefaultRequisite(contractorId: number, requisiteId: number): Promise<void> {
    await this.patch(`/contractors/${contractorId}/requisites/${requisiteId}/default`);
  }

  async deleteRequisite(contractorId: number, requisiteId: number): Promise<void> {
    await this.delete(`/contractors/${contractorId}/requisites/${requisiteId}`);
  }

  // --- Payments ---

  /**
   * Create a payment for an existing contractor.
   * For self-employed: direct payout, receipt auto-generated via "Мой налог"
   * For individuals: Jump creates act for signing first (status 8)
   */
  async createPayment(params: {
    contractorId: number;
    amount: number; // in rubles (not kopecks!)
    requisiteId: number;
    serviceName: string;
    paymentPurpose: string;
    customerPaymentId: string; // our unique ID, max 36 chars
  }): Promise<{ item: JumpPayment }> {
    return this.post("/payments", {
      contractor_id: params.contractorId,
      amount: params.amount,
      agent_id: parseInt(this.agentId) || undefined,
      bank_account_id: parseInt(this.bankAccountId) || undefined,
      requisite_id: params.requisiteId,
      service_name: params.serviceName,
      payment_purpose: params.paymentPurpose,
      customer_payment_id: params.customerPaymentId,
    });
  }

  /**
   * Create payment + contractor in one call (smart payment).
   * Use when contractor doesn't exist yet in Jump.
   */
  async createSmartPayment(params: {
    phone: string;
    firstName: string;
    lastName: string;
    middleName?: string;
    amount: number; // in rubles
    requisite: { typeId: number; accountNumber?: string; sbpBankId?: number };
    serviceName: string;
    paymentPurpose: string;
    customerPaymentId: string;
  }): Promise<{ item: JumpPayment }> {
    const body: Record<string, unknown> = {
      phone: params.phone,
      first_name: params.firstName,
      last_name: params.lastName,
      middle_name: params.middleName,
      amount: params.amount,
      agent_id: parseInt(this.agentId) || undefined,
      bank_account_id: parseInt(this.bankAccountId) || undefined,
      requisite: {
        type_id: params.requisite.typeId,
        ...(params.requisite.accountNumber && { account_number: params.requisite.accountNumber }),
        ...(params.requisite.sbpBankId && { sbp_bank_id: params.requisite.sbpBankId }),
      },
      service_name: params.serviceName,
      payment_purpose: params.paymentPurpose,
      customer_payment_id: params.customerPaymentId,
    };

    // SBP validation data (required for SBP payments)
    if (params.requisite.typeId === REQUISITE_TYPE.SBP) {
      body.sbp_validation_data = {
        first_name: params.firstName,
        middle_name: params.middleName,
        last_name: params.lastName,
      };
    }

    return this.post("/payments/smart", body);
  }

  async getPayment(id: string, include?: string): Promise<{ item: JumpPayment }> {
    const query: Record<string, string> = {};
    if (include) query.include = include;
    return this.get(`/payments/${id}`, query);
  }

  async getPaymentByCustomerId(customerPaymentId: string, include?: string): Promise<{ item: JumpPayment }> {
    const query: Record<string, string> = {};
    if (include) query.include = include;
    return this.get(`/payments/customer-payment/${customerPaymentId}`, query);
  }

  async listPayments(params?: {
    statusId?: number;
    contractorId?: number;
    page?: number;
    perPage?: number;
  }): Promise<JumpListResponse<JumpPayment>> {
    const query: Record<string, string | number> = {};
    if (params?.statusId) query.status_id = params.statusId;
    if (params?.contractorId) query.contractor_id = params.contractorId;
    if (params?.page) query.page = params.page;
    if (params?.perPage) query.per_page = params.perPage;
    return this.get("/payments", query);
  }

  async repeatPayment(paymentId: string): Promise<{ item: JumpPayment }> {
    return this.post(`/payments/${paymentId}/repeat`);
  }

  // --- Identification ---

  async forceIdentify(contractorId: number): Promise<void> {
    await this.post(`/contractors/${contractorId}/force-identify`);
  }

  async getIdentificationStatus(contractorId: number): Promise<{ item: JumpIdentification }> {
    return this.get(`/contractors/${contractorId}/identification/last-approved`);
  }

  async listIdentifications(page = 1, perPage = 20): Promise<JumpListResponse<JumpIdentification>> {
    return this.get("/contractors/identifications", { page, per_page: perPage });
  }

  // --- Acts ---

  async getAct(id: number): Promise<{ item: JumpAct }> {
    return this.get(`/acts/${id}`);
  }

  async downloadAct(id: number): Promise<ArrayBuffer> {
    if (!this.apiKey) {
      throw new JumpFinanceError(0, null, "Jump.Finance API key not configured");
    }

    const url = `${this.baseUrl}/acts/${id}/download`;
    const res = await fetch(url, {
      headers: {
        "Client-Key": this.apiKey,
        "Accept": "application/pdf",
      },
    });

    if (!res.ok) {
      throw new JumpFinanceError(res.status, null, `Failed to download act ${id}`);
    }

    return res.arrayBuffer();
  }

  // --- Bank accounts ---

  async listBankAccounts(): Promise<JumpListResponse<{ id: number; balance: number; name: string }>> {
    return this.get("/banks_accounts");
  }
}

// Singleton instance
export const jumpFinance = new JumpFinanceClient();

// --- Helper functions ---

/**
 * Parse agent full name into first/last/middle for Jump API.
 * Russian names: "Иванов Иван Иванович" → { lastName: "Иванов", firstName: "Иван", middleName: "Иванович" }
 */
export function parseAgentName(fullName: string): {
  firstName: string;
  lastName: string;
  middleName?: string;
} {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length >= 3) {
    return { lastName: parts[0], firstName: parts[1], middleName: parts.slice(2).join(" ") };
  }
  if (parts.length === 2) {
    return { lastName: parts[0], firstName: parts[1] };
  }
  return { lastName: fullName, firstName: fullName };
}

/**
 * Generate a unique customer_payment_id for Jump (max 36 chars).
 * Format: "DD-{paymentId}-{timestamp}"
 */
export function makeCustomerPaymentId(paymentId: number): string {
  return `DD-${paymentId}-${Date.now()}`.slice(0, 36);
}

/**
 * Mask a card number for display: "4111111111111111" → "**** **** **** 1111"
 */
export function maskCardNumber(cardNumber: string): string {
  const digits = cardNumber.replace(/\D/g, "");
  if (digits.length < 4) return "****";
  return `**** **** **** ${digits.slice(-4)}`;
}

/**
 * Validate card number with Luhn algorithm.
 */
export function validateCardNumber(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let isEven = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);
    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    isEven = !isEven;
  }
  return sum % 10 === 0;
}

/**
 * Determine the legal_form_id for Jump based on self-employment status.
 */
export function getLegalFormId(isSelfEmployed: string): number {
  return isSelfEmployed === "yes" ? LEGAL_FORM.SELF_EMPLOYED : LEGAL_FORM.INDIVIDUAL;
}
