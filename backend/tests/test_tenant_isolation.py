import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.app.core.database import Base
from backend.app.models.organization import Institute, InstituteMember
from backend.app.models.crm import Lead
from backend.app.permissions.tenant import get_tenant_context
from backend.app.core.config import settings

INTERNAL_API_KEY = "test-internal-api-key"

# In-memory SQLite for testing isolation
TEST_DB_URL = "sqlite:///:memory:"
test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

@pytest.fixture(autouse=True)
def setup_test_db():
    settings.INTERNAL_API_KEY = INTERNAL_API_KEY
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()
    
    # Create Institute A
    inst_a = Institute(
        id="org-a",
        name="Institute Alpha",
        slug="alpha-academy",
        owner_user_id="usr-owner-a",
        status="ACTIVE",
    )
    # Create Institute B
    inst_b = Institute(
        id="org-b",
        name="Institute Beta",
        slug="beta-academy",
        owner_user_id="usr-owner-b",
        status="ACTIVE",
    )
    # Create Teacher in Institute A
    member_a = InstituteMember(
        id="mem-1",
        institute_id="org-a",
        user_id="usr-teacher-a",
        role="TEACHER",
        status="ACTIVE",
    )
    # Create confidential Lead in Institute A
    lead_a = Lead(
        id="lead-confidential-a",
        organization_id="org-a",
        name="Secret Student A",
        phone="+919876543210",
        target_exam="JEE_ADVANCED",
    )

    db.add_all([inst_a, inst_b, member_a, lead_a])
    db.commit()
    db.close()

    yield

    Base.metadata.drop_all(bind=test_engine)

def test_owner_access_own_tenant():
    db = TestingSessionLocal()
    context = get_tenant_context(
        x_organization_id="org-a",
        x_user_id="usr-owner-a",
        x_internal_api_key=INTERNAL_API_KEY,
        db=db,
    )
    assert context.organization_id == "org-a"
    assert context.role == "OWNER"
    db.close()

def test_cross_tenant_access_blocked():
    """User from Institute B attempting to access Institute A data must be rejected with 403."""
    db = TestingSessionLocal()
    with pytest.raises(HTTPException) as exc_info:
        get_tenant_context(
            x_organization_id="org-a",
            x_user_id="usr-owner-b",  # Owner of B tries to query Org A
            x_internal_api_key=INTERNAL_API_KEY,
            db=db,
        )
    assert exc_info.value.status_code == 403
    assert "You are not an active member of this organization" in exc_info.value.detail
    db.close()

def test_untrusted_headers_without_internal_auth_are_rejected():
    db = TestingSessionLocal()
    with pytest.raises(HTTPException) as exc_info:
        get_tenant_context(
            x_organization_id="org-a",
            x_user_id="usr-owner-a",
            x_internal_api_key=None,
            db=db,
        )
    assert exc_info.value.status_code == 401
    db.close()

def test_tenant_data_scoping():
    """Queries scoped by organization_id must never leak rows across tenants."""
    db = TestingSessionLocal()
    # Org B queries leads scoped to Org B
    org_b_leads = db.query(Lead).filter(Lead.organization_id == "org-b").all()
    assert len(org_b_leads) == 0

    # Org A queries leads scoped to Org A
    org_a_leads = db.query(Lead).filter(Lead.organization_id == "org-a").all()
    assert len(org_a_leads) == 1
    assert org_a_leads[0].name == "Secret Student A"
    db.close()
