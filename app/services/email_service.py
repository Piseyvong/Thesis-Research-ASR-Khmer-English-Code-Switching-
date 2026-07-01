from __future__ import annotations

from sqlmodel import Session
import json

from app.storage.models import MockEmail, EmailAudience, RequestRecord


class EmailService:
    def __init__(self, session: Session):
        self.session = session

    def _log(self, audience: EmailAudience, subject: str, body: str, request_id: int | None) -> None:
        email = MockEmail(audience=audience, subject=subject, body=body, request_id=request_id)
        self.session.add(email)

    def _fields(self, rec: RequestRecord) -> dict:
        try:
            return json.loads(rec.fields_json or "{}")
        except Exception:
            return {}

    # Employee emails
    def employee_request_submitted(self, rec: RequestRecord) -> None:
        subject = "Request Submitted Successfully"
        body = (
            f"Dear {rec.employee_name},\n\n"
            f"Your {rec.form_type or 'request'} request has been submitted successfully.\n\n"
            f"Request ID: {rec.id}\n"
            f"Selected ASR Model: {rec.selected_model}\n"
            f"Confidence Score: {rec.selected_confidence}\n"
            f"Status: {rec.status.value}\n\n"
            "The request has been sent to your manager for review."
        )
        self._log(EmailAudience.employee, subject, body, rec.id)

    def employee_request_approved(self, rec: RequestRecord) -> None:
        subject = "Request Approved"
        body = (
            f"Dear {rec.employee_name},\n\n"
            f"Your request (ID: {rec.id}) has been approved.\n\n"
            f"Manager comment: {rec.manager_comment or '-'}\n"
        )
        self._log(EmailAudience.employee, subject, body, rec.id)

    def employee_request_rejected(self, rec: RequestRecord) -> None:
        subject = "Request Rejected"
        body = (
            f"Dear {rec.employee_name},\n\n"
            f"Your request (ID: {rec.id}) has been rejected.\n\n"
            f"Manager comment: {rec.manager_comment or '-'}\n"
        )
        self._log(EmailAudience.employee, subject, body, rec.id)

    def employee_needs_clarification(self, rec: RequestRecord, question: str) -> None:
        subject = "Manager Asked for Clarification"
        body = (
            f"Dear {rec.employee_name},\n\n"
            f"Your request (ID: {rec.id}) needs clarification:\n"
            f"{question}\n\n"
            "Please reply in the chatbot and update the request." 
        )
        self._log(EmailAudience.employee, subject, body, rec.id)

    # Manager emails
    def manager_new_request(self, rec: RequestRecord) -> None:
        fields = self._fields(rec)
        location = fields.get("province_or_city") or fields.get("location")
        amount = fields.get("amount")
        reason = fields.get("reason")
        subject = "New Request Pending Approval"
        body = (
            "Dear Manager,\n\n"
            f"A new {rec.form_type or 'request'} request has been submitted by {rec.employee_name}.\n\n"
            f"Request ID: {rec.id}\n"
            f"English Summary: {rec.summary or '-'}\n"
            f"Detected Location: {location or '-'}\n"
            f"Amount: {amount or '-'}\n"
            f"Reason: {reason or '-'}\n\n"
            "Please review the request in the manager dashboard."
        )
        self._log(EmailAudience.manager, subject, body, rec.id)

    def manager_employee_updated(self, rec: RequestRecord) -> None:
        subject = "Employee Updated Request"
        body = (
            "Dear Manager,\n\n"
            f"Employee {rec.employee_name} updated request {rec.id}.\n"
            "Please review the latest details." 
        )
        self._log(EmailAudience.manager, subject, body, rec.id)

    def manager_pending_reminder(self, rec: RequestRecord) -> None:
        subject = "Pending Approval Reminder"
        body = (
            "Dear Manager,\n\n"
            f"Reminder: Request {rec.id} is pending review." 
        )
        self._log(EmailAudience.manager, subject, body, rec.id)
