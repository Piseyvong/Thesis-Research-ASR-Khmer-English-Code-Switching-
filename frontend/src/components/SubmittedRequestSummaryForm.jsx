function valueOrFallback(value) {
  return value || "-";
}

function getDescriptionLabel(request) {
  const fields = request?.fields || {};
  return request?.english_translation || fields.reason || fields.purpose || request?.summary || "-";
}

function getQuantityLabel(request) {
  const quantity = request?.fields?.quantity;
  if (quantity) {
    return String(quantity);
  }
  return request?.fields?.amount ? "1" : "-";
}

function getPriceLabel(request) {
  return valueOrFallback(request?.fields?.amount);
}

function getAmountLabel(request) {
  const fields = request?.fields || {};
  return [fields.amount, fields.currency].filter(Boolean).join(" ") || "-";
}

export default function SubmittedRequestSummaryForm({ request }) {
  if (!request) {
    return null;
  }

  const amountLabel = getAmountLabel(request);

  return (
    <section className="summary-request">
      <div className="summary-request__title">Summary Request Info</div>

      <div className="summary-request__meta">
        <div className="summary-request__meta-row">
          <span className="summary-request__meta-label">Form Name:</span>
          <span className="summary-request__meta-value">{valueOrFallback(request.form_type)}</span>
        </div>
        <div className="summary-request__meta-row">
          <span className="summary-request__meta-label">Quote Number:</span>
          <span className="summary-request__meta-value">{valueOrFallback(request.request_number)}</span>
        </div>
      </div>

      <div className="summary-request__table">
        <div className="summary-request__table-row summary-request__table-row--head">
          <div>No</div>
          <div>Description</div>
          <div>Qty</div>
          <div>Price</div>
          <div>Amount</div>
        </div>

        <div className="summary-request__table-row">
          <div>1</div>
          <div>{getDescriptionLabel(request)}</div>
          <div>{getQuantityLabel(request)}</div>
          <div>{getPriceLabel(request)}</div>
          <div>{amountLabel}</div>
        </div>

        <div className="summary-request__table-row summary-request__table-row--total">
          <div className="summary-request__table-total-label">Total Amount</div>
          <div className="summary-request__table-total-value">{amountLabel}</div>
        </div>
      </div>

      <div className="summary-request__note">If you have any attachment please add before submit!</div>
    </section>
  );
}
