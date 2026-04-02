export type PayrollEmployee = {
  id: string;
  firstName: string;
  lastName: string;
  identityNumber: string | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | 'UNSPECIFIED' | null;
  birthDate: string | null;
  ibanOrBankAccount: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PayrollEmploymentRecord = {
  id: string;
  employeeId: string;
  departmentName: string | null;
  titleName: string | null;
  arrivalDate: string;
  accrualStartDate: string;
  sgkStartDate: string | null;
  sgkEntryDocumentPath: string | null;
  sgkEntryDocumentName: string | null;
  exitDate: string | null;
  sgkExitDocumentPath: string | null;
  sgkExitDocumentName: string | null;
  status: 'ACTIVE' | 'EXITED' | 'DRAFT';
  insuranceStatus: 'INSURED' | 'EXITED' | 'PENDING';
  createdAt: string;
  updatedAt: string;
  employee: PayrollEmployee;
  compensationProfiles?: PayrollCompensationProfile[];
};

export type PayrollCompensationProfile = {
  id: string;
  employmentRecordId: string;
  matrixRowId: string | null;
  targetAccrualSalary: string;
  officialNetSalary: string;
  overtimeEligible: boolean;
  bonusEligible: boolean;
  handCashAllowed: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  employmentRecord: PayrollEmploymentRecord;
  matrixRow?: PayrollCompensationMatrixRow | null;
};

export type PayrollCompensationMatrixRow = {
  id: string;
  targetAccrualSalary: string;
  officialNetSalary: string;
  isActive: boolean;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PayrollEmployeeImportPreviewRow = {
  rowNumber: number;
  firstName: string;
  lastName: string;
  identityNumber: string;
  birthDate: string;
  iban: string;
  errors: string[];
  valid: boolean;
};

export type PayrollEmployeeImportPreview = {
  rows: PayrollEmployeeImportPreviewRow[];
  validRows: PayrollEmployeeImportPreviewRow[];
  invalidRows: PayrollEmployeeImportPreviewRow[];
};

export type CompanyDepartmentOption = {
  id: string;
  name: string;
  isActive: boolean;
};

export type CompanyTitleOption = {
  id: string;
  departmentId: string;
  name: string;
  isActive: boolean;
  department?: CompanyDepartmentOption | null;
};
export type LegacyWorklogEmployee = {
  id: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
};

export type PayrollWorkLog = {
  id: string;
  date: string;
  hoursWorked: string;
  employee: LegacyWorklogEmployee;
};

export type PayrollLine = {
  id: string;
  grossAmount: string;
  notes: string | null;
  employee: LegacyWorklogEmployee;
};

export type PayrollPeriod = {
  id: string;
  startDate: string;
  endDate: string;
  status: 'DRAFT' | 'CALCULATED' | 'POSTED';
  totalGross: string;
  totalNet: string;
  lines: PayrollLine[];
};
