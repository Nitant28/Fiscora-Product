export type CreatePurchaseRequestInput = {
  title: string;
  vendorName: string;
  estimatedAmount: number;
  description?: string;
  categoryId: number;
  requester: string;
  requesterId?: number;
  departmentId?: number;
};

export type PurchaseRequestRecord = {
  id: number;
  title: string;
  description: string | null;
  vendorName: string | null;
  requester: string;
  estimatedAmount: number;
  status: string;
  approvedBy: string | null;
  approvedAt: Date | null;
  createdAt: Date;
};
