export const CATEGORY_OPTIONS = [
  "Cash Advance Form",
  "Expense Claim Form",
  "Material Request Form",
  "Training Request Form",
  "Traveling Request Form",
  "Project Expense Form",
];

const ALL_FIELD_KEYS = [
  "employee_name",
  "amount",
  "currency",
  "location",
  "province_or_city",
  "date",
  "reason",
  "purpose",
  "priority",
  "material_name",
  "training_type",
  "travel_type",
];

const SHARED_FIELD_KEYS = [
  "employee_name",
  "amount",
  "currency",
  "location",
  "province_or_city",
  "reason",
  "purpose",
  "priority",
];

const FORM_SCHEMAS = {
  "Cash Advance Form": {
    extraFields: [],
    requiredFields: ["employee_name", "reason", "province_or_city", "amount", "currency"],
    moneyRequired: true,
  },
  "Expense Claim Form": {
    extraFields: [],
    requiredFields: ["employee_name", "reason", "amount", "currency"],
    moneyRequired: true,
  },
  "Material Request Form": {
    extraFields: ["material_name"],
    requiredFields: ["employee_name", "reason", "material_name"],
    moneyRequired: false,
  },
  "Training Request Form": {
    extraFields: ["date", "training_type"],
    requiredFields: ["employee_name", "reason", "training_type"],
    moneyRequired: false,
  },
  "Traveling Request Form": {
    extraFields: ["travel_type"],
    requiredFields: ["employee_name", "reason", "province_or_city", "travel_type"],
    moneyRequired: false,
  },
  "Project Expense Form": {
    extraFields: ["date", "material_name"],
    requiredFields: ["employee_name", "reason", "amount", "currency"],
    moneyRequired: true,
  },
};

export const FIELD_META = {
  date: {
    label: "Date",
    placeholder: "Enter date",
  },
  material_name: {
    label: "Material name",
    placeholder: "Enter material name",
  },
  training_type: {
    label: "Training type",
    placeholder: "Enter training type",
  },
  travel_type: {
    label: "Travel type",
    placeholder: "Enter travel type",
  },
  priority: {
    label: "Priority",
    placeholder: "Select priority",
  },
};

export function createEmptyRequestFields() {
  return ALL_FIELD_KEYS.reduce((accumulator, key) => {
    accumulator[key] = "";
    return accumulator;
  }, {});
}

export function toDraftFields(fields = {}) {
  const next = createEmptyRequestFields();
  for (const key of ALL_FIELD_KEYS) {
    next[key] = normalizeText(fields?.[key]);
  }
  return next;
}

export function sanitizeFieldsForForm(formType, fields) {
  const draft = toDraftFields(fields);
  const schema = FORM_SCHEMAS[formType];
  const allowedKeys = new Set(schema ? [...SHARED_FIELD_KEYS, ...schema.extraFields] : ALL_FIELD_KEYS);

  if (!draft.reason && draft.purpose) {
    draft.reason = draft.purpose;
  }
  if (!draft.purpose && draft.reason) {
    draft.purpose = draft.reason;
  }

  if (!draft.province_or_city && draft.location) {
    draft.province_or_city = draft.location;
  }
  if (!draft.location && draft.province_or_city) {
    draft.location = draft.province_or_city;
  }

  if (formType === "Traveling Request Form" && !draft.travel_type) {
    draft.travel_type = inferTravelType(`${draft.reason} ${draft.purpose}`);
  }

  return ALL_FIELD_KEYS.reduce((accumulator, key) => {
    accumulator[key] = allowedKeys.has(key) ? draft[key] : "";
    return accumulator;
  }, {});
}

export function serializeFieldsForApi(formType, fields) {
  const sanitized = sanitizeFieldsForForm(formType, fields);

  return Object.fromEntries(
    Object.entries(sanitized).map(([key, value]) => [key, normalizeText(value) || null])
  );
}

export function validateRequestDetails(formType, fields) {
  const normalized = sanitizeFieldsForForm(formType, fields);
  const serialized = serializeFieldsForApi(formType, fields);
  const schema = FORM_SCHEMAS[formType] || { requiredFields: ["employee_name", "reason"], moneyRequired: false };
  const errors = {};

  if (!formType) {
    errors.form_type = "Select a form type.";
  }

  if (!serialized.employee_name) {
    errors.employee_name = "Requester name is required.";
  }

  if (!serialized.reason && !serialized.purpose) {
    errors.reason = "Reason is required.";
  }

  if (schema.requiredFields.includes("province_or_city") && !serialized.province_or_city && !serialized.location) {
    errors.province_or_city = "Location or city is required.";
  }

  if (schema.requiredFields.includes("date") && !serialized.date) {
    errors.date = "Date is required.";
  }

  if (schema.requiredFields.includes("material_name") && !serialized.material_name) {
    errors.material_name = "Material name is required.";
  }

  if (schema.requiredFields.includes("training_type") && !serialized.training_type) {
    errors.training_type = "Training type is required.";
  }

  if (schema.requiredFields.includes("travel_type") && !serialized.travel_type) {
    errors.travel_type = "Travel type is required.";
  }

  if (schema.moneyRequired && !serialized.amount) {
    errors.amount = "Amount is required.";
  }

  if (serialized.amount && !serialized.currency) {
    errors.currency = "Currency is required when amount is provided.";
  }

  return {
    errors,
    normalizedFields: normalized,
    serializedFields: serialized,
    helperMessage: Object.keys(errors).length ? "Complete the required fields before saving or submitting." : "",
  };
}

export function getExtraFieldKeys(formType) {
  return FORM_SCHEMAS[formType]?.extraFields || [];
}

export function getRequiredFieldKeys(formType) {
  const schema = FORM_SCHEMAS[formType];
  const baseRequired = schema?.requiredFields || ["employee_name", "reason"];
  const required = new Set(baseRequired);

  if (schema?.moneyRequired) {
    required.add("amount");
    required.add("currency");
  }

  return [...required];
}

export function getRequestDetailSignature(formType, fields) {
  return JSON.stringify({
    formType: formType || "",
    fields: serializeFieldsForApi(formType, fields),
  });
}

function normalizeText(value) {
  return value == null ? "" : String(value).trim();
}

function inferTravelType(text) {
  const normalized = normalizeText(text).toLowerCase();

  if (!normalized) {
    return "";
  }

  if (/\bbusiness\s+(trip|travel)\b|\bwork\s+trip\b/.test(normalized)) {
    return "Business Trip";
  }
  if (/\bvisit\s+(customer|client)\b|\b(customer|client)\s+visit\b/.test(normalized)) {
    return "Visit Customer";
  }
  if (/\b(overseas|international|flight)\b/.test(normalized)) {
    return "Overseas";
  }
  if (/\b(local|domestic|province)\b/.test(normalized)) {
    return "Local";
  }
  if (/\b(event|conference|seminar|workshop)\b/.test(normalized)) {
    return "Event";
  }
  if (/\btrip|travel\b/.test(normalized)) {
    return "Travel";
  }

  return "";
}
