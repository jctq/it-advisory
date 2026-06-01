#!/usr/bin/env python3
"""Bulk rename quiz → diagnostic in TS/TSX sources (identifiers, JSON keys, Mongo fields)."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

SKIP_PARTS = {"node_modules", ".next", "dist", ".git"}

# Longest-first identifier / literal replacements.
REPLACEMENTS: list[tuple[str, str]] = [
    # Types & result shapes
    ("PaginatedVisitorQuizSessionsResult", "PaginatedVisitorDiagnosticSessionsResult"),
    ("VisitorQuizSessionListStatusFilter", "VisitorDiagnosticSessionListStatusFilter"),
    ("VisitorQuizSessionSummary", "VisitorDiagnosticSessionSummary"),
    ("DeleteQuizSessionForVisitorResult", "DeleteDiagnosticSessionForVisitorResult"),
    ("UpsertQuizProgressInput", "UpsertDiagnosticProgressInput"),
    ("UpsertQuizProgressResult", "UpsertDiagnosticProgressResult"),
    ("QuizSessionLinkedBookingSlot", "DiagnosticSessionLinkedBookingSlot"),
    ("QuizSessionDisplayPreview", "DiagnosticSessionDisplayPreview"),
    ("QuizSessionLinkedBooking", "DiagnosticSessionLinkedBooking"),
    ("MarketingUserQuizSnapshotRow", "MarketingUserDiagnosticSnapshotRow"),
    ("QuizSessionListRow", "DiagnosticSessionListRow"),
    ("QuizSessionDetail", "DiagnosticSessionDetail"),
    ("QuizAuditAdminRow", "DiagnosticAuditAdminRow"),
    ("QuizSessionDocument", "DiagnosticSessionDocument"),
    ("QuizAuditDocument", "DiagnosticAuditDocument"),
    ("QuizSessionPayload", "DiagnosticSessionPayload"),
    ("SaveQuizSessionInput", "SaveDiagnosticSessionInput"),
    ("SaveQuizSessionPayload", "SaveDiagnosticSessionPayload"),
    ("QuizAnswers", "DiagnosticAnswers"),
    # Functions
    ("fetchLatestPaymentTransactionsByQuizSessionIds", "fetchLatestPaymentTransactionsByDiagnosticSessionIds"),
    ("listOpenPaymentTransactionsByQuizSessionIdHex", "listOpenPaymentTransactionsByDiagnosticSessionIdHex"),
    ("findLatestPaymentTransactionByQuizSessionIdHex", "findLatestPaymentTransactionByDiagnosticSessionIdHex"),
    ("findVerifiedQuizSessionPendingBookingForCheckout", "findVerifiedDiagnosticSessionPendingBookingForCheckout"),
    ("findQuizSessionPendingBookingRecord", "findDiagnosticSessionPendingBookingRecord"),
    ("diagnoseQuizSessionExistingBookingPayability", "diagnoseDiagnosticSessionExistingBookingPayability"),
    ("resolveQuizSessionSummaryDisplayPreview", "resolveDiagnosticSessionSummaryDisplayPreview"),
    ("resolveQuizSessionDiagnosticCompleted", "resolveDiagnosticSessionCompleted"),
    ("resolveQuizSessionDisplayPreview", "resolveDiagnosticSessionDisplayPreview"),
    ("extractGuidedDiagnosticRawFromQuizAnswers", "extractGuidedDiagnosticRawFromDiagnosticAnswers"),
    ("ensureTransactionBookingLinkedToQuizSession", "ensureTransactionBookingLinkedToDiagnosticSession"),
    ("createBookingWithLatestQuizSnapshot", "createBookingWithLatestDiagnosticSnapshot"),
    ("syncBookingQuizSessionIfPointerChanged", "syncBookingDiagnosticSessionIfPointerChanged"),
    ("linkQuizSessionToVisitorBooking", "linkDiagnosticSessionToVisitorBooking"),
    ("findPrimaryBookingSlotByQuizSessionId", "findPrimaryBookingSlotByDiagnosticSessionId"),
    ("countBookingsByQuizSessionId", "countBookingsByDiagnosticSessionId"),
    ("pickPrimaryBookingForQuizSession", "pickPrimaryBookingForDiagnosticSession"),
    ("releaseSlotReservationsForQuizSession", "releaseSlotReservationsForDiagnosticSession"),
    ("reconcileQuizSessionPaidBookingLink", "reconcileDiagnosticSessionPaidBookingLink"),
    ("syncQuizSessionPaymentHold", "syncDiagnosticSessionPaymentHold"),
    ("ensureQuizSessionPendingBookingReadyForCheckout", "ensureDiagnosticSessionPendingBookingReadyForCheckout"),
    ("syncVisitorQuizDiagnosticCompletion", "syncVisitorDiagnosticCompletion"),
    ("listQuizSessionsForVisitorPaginated", "listDiagnosticSessionsForVisitorPaginated"),
    ("insertBlankQuizSessionForVisitor", "insertBlankDiagnosticSessionForVisitor"),
    ("deleteQuizSessionForVisitor", "deleteDiagnosticSessionForVisitor"),
    ("findQuizSessionForBookingSnapshot", "findDiagnosticSessionForBookingSnapshot"),
    ("findIncompleteQuizSession", "findIncompleteDiagnosticSession"),
    ("listQuizSessionsForVisitor", "listDiagnosticSessionsForVisitor"),
    ("listQuizSessionsForAdmin", "listDiagnosticSessionsForAdmin"),
    ("findQuizSessionForVisitor", "findDiagnosticSessionForVisitor"),
    ("findLatestQuizSession", "findLatestDiagnosticSession"),
    ("findQuizSessionById", "findDiagnosticSessionById"),
    ("listQuizAuditForSession", "listDiagnosticAuditForSession"),
    ("upsertQuizProgress", "upsertDiagnosticProgress"),
    ("isQuizSessionEditingLocked", "isDiagnosticSessionEditingLocked"),
    ("encodeQuizSessionRefForMarketingUrl", "encodeDiagnosticSessionRefForMarketingUrl"),
    ("resolveQuizSessionObjectIdHexFromMarketingRef", "resolveDiagnosticSessionObjectIdHexFromMarketingRef"),
    ("isPlausibleMarketingQuizSessionRef", "isPlausibleMarketingDiagnosticSessionRef"),
    ("buildMarketingQuizSessionPath", "buildMarketingDiagnosticSessionPath"),
    ("buildMarketingQuizRetakePath", "buildMarketingDiagnosticRetakePath"),
    ("parseQuizSessionIdFromGuestFreshStartPayload", "parseDiagnosticSessionIdFromGuestFreshStartPayload"),
    ("parseQuizSessionIdFromApiPayload", "parseDiagnosticSessionIdFromApiPayload"),
    ("ensureGuestQuizFreshStart", "ensureGuestDiagnosticFreshStart"),
    ("postNewMarketingQuizSession", "postNewMarketingDiagnosticSession"),
    ("useMarketingActiveQuizNavigation", "useMarketingActiveDiagnosticNavigation"),
    ("buildQuizAnswersPayload", "buildDiagnosticAnswersPayload"),
    ("fetchQuizSessionBySessionRef", "fetchDiagnosticSessionBySessionRef"),
    ("saveQuizSession", "saveDiagnosticSession"),
    ("fetchQuizSession", "fetchDiagnosticSession"),
    ("mapQuizSnapshotRow", "mapDiagnosticSnapshotRow"),
    ("resolveQuizSnapshot", "resolveDiagnosticSnapshot"),
    # Constants & env
    ("MARKETING_QUIZ_SESSION_REF_PREFIX", "MARKETING_DIAGNOSTIC_SESSION_REF_PREFIX"),
    ("LEGACY_MARKETING_QUIZ_SESSION_REF_PREFIX", "LEGACY_MARKETING_QUIZ_SESSION_REF_PREFIX"),
    ("DIAGNOSTIC_SESSION_URL_SECRET", "DIAGNOSTIC_SESSION_URL_SECRET"),
    # Collection keys & literals
    ("COLLECTIONS.quizSessions", "COLLECTIONS.diagnosticSessions"),
    ("COLLECTIONS.quizAudit", "COLLECTIONS.diagnosticAudit"),
    ("'quiz_sessions'", "'diagnostic_sessions'"),
    ('"quiz_sessions"', '"diagnostic_sessions"'),
    ("'quiz_audit'", "'diagnostic_audit'"),
    ('"quiz_audit"', '"diagnostic_audit"'),
    ("quizSessions:", "diagnosticSessions:"),
    ("quizAudit:", "diagnosticAudit:"),
    # JSON / document fields (hex before bare id)
    ("excludeQuizSessionIdHex", "excludeDiagnosticSessionIdHex"),
    ("preferredQuizSessionId", "preferredDiagnosticSessionId"),
    ("quizSessionIdHex", "diagnosticSessionIdHex"),
    ("quizSessionMarketingRef", "diagnosticSessionMarketingRef"),
    ("quizSessionIdRaw", "diagnosticSessionIdRaw"),
    ("quizSessionId", "diagnosticSessionId"),
    ("quizSessionLinked", "diagnosticSessionLinked"),
    ("quizSessionById", "diagnosticSessionById"),
    ("quizSessionDocs", "diagnosticSessionDocs"),
    ("quizSessionIds", "diagnosticSessionIds"),
    ("quizSessionsTotal", "diagnosticSessionsTotal"),
    ("quizSessionsCompleted", "diagnosticSessionsCompleted"),
    # Error / status codes
    ("quiz_session_not_accessible", "diagnostic_session_not_accessible"),
    ("quiz_session_already_booked", "diagnostic_session_already_booked"),
    ("quiz_session_read_only", "diagnostic_session_read_only"),
    ("quiz_session_invalid_id", "diagnostic_session_invalid_id"),
    ("quiz_session_not_found", "diagnostic_session_not_found"),
    ("booking_missing_quiz_session", "booking_missing_diagnostic_session"),
    ("quiz_link_failed", "diagnostic_link_failed"),
    # Index names
    ("quiz_sessions_visitor_updated", "diagnostic_sessions_visitor_updated"),
    ("bookings_quiz_session_created", "bookings_diagnostic_session_created"),
    ("payments_quiz_session_created", "payments_diagnostic_session_created"),
    # URL ref prefix (new encodings use ds1.; readers accept qs1. legacy)
    ("'qs1.'", "'ds1.'"),
    ('"qs1."', '"ds1."'),
    # Props / locals common patterns
    ("hasValidQuizSessionParam", "hasValidDiagnosticSessionParam"),
    ("ownedQuizSession", "ownedDiagnosticSession"),
    ("resolvedQuizSessionHex", "resolvedDiagnosticSessionHex"),
    ("trimmedQuizSessionId", "trimmedDiagnosticSessionId"),
    ("quizPayload", "diagnosticPayload"),
    ("quizFallback", "diagnosticFallback"),
    ("quizState", "diagnosticState"),
]

COMMENT_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\bquiz_sessions\b"), "diagnostic_sessions"),
    (re.compile(r"\bquiz_audit\b"), "diagnostic_audit"),
    (re.compile(r"\bquiz session\b", re.I), "diagnostic session"),
    (re.compile(r"\bquiz sessions\b", re.I), "diagnostic sessions"),
]


def patch_file(path: Path) -> bool:
    if path.name == "rename-quiz-to-diagnostic-symbols.py":
        return False
    text = path.read_text(encoding="utf-8")
    original = text
    for old, new in REPLACEMENTS:
        text = text.replace(old, new)
    for pattern, repl in COMMENT_PATTERNS:
        text = pattern.sub(repl, text)
    if text != original:
        path.write_text(text, encoding="utf-8")
        return True
    return False


def main() -> None:
    changed = 0
    for path in ROOT.rglob("*"):
        if path.suffix not in {".ts", ".tsx"}:
            continue
        if any(part in SKIP_PARTS for part in path.parts):
            continue
        if patch_file(path):
            changed += 1
    print(f"Updated {changed} files")


if __name__ == "__main__":
    main()
