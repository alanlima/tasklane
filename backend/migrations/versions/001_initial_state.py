"""initial Tasklane persistence state"""
from alembic import op
import sqlalchemy as sa
revision = "001_initial_state"
down_revision = None
def upgrade(): op.create_table("tasklane_state", sa.Column("id", sa.String(32), primary_key=True), sa.Column("value", sa.JSON(), nullable=False))
def downgrade(): op.drop_table("tasklane_state")
