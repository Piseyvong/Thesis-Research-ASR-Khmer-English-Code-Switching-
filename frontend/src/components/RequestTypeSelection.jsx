const REQUEST_TYPE_DESCRIPTIONS = {
  "Cash Advance Form": "Request working funds for travel, client meetings, or approved business activity.",
  "Expense Claim Form": "Submit reimbursable business expenses that have already been paid.",
  "Material Request Form": "Request materials, supplies, or operational items for day-to-day work.",
  "Training Request Form": "Ask for approval to join internal or external training programs.",
  "Traveling Request Form": "Create business travel requests with location, schedule, and justification.",
  "Project Expense Form": "Request project-specific spending tied to an approved initiative.",
};

export default function RequestTypeSelection({ requestTypes, onSelectRequestType, onCancel }) {
  return (
    <div className="request-type-selection">
      <header className="request-type-selection__hero">
        <div>
          <div className="request-type-selection__eyebrow">New request</div>
          <h1 className="request-type-selection__title">Choose a request form</h1>
          <p className="request-type-selection__copy">
            Select the formal request template first. After that, the drafting workspace will open for voice or text input.
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Back to requests
        </button>
      </header>

      <section className="request-type-selection__section">
        <div className="request-type-selection__grid">
          {requestTypes.map((type) => (
            <button key={type} type="button" className="request-type-selection__card" onClick={() => onSelectRequestType(type)}>
              <div className="request-type-selection__card-title">{type}</div>
              <div className="request-type-selection__card-copy">{REQUEST_TYPE_DESCRIPTIONS[type]}</div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
