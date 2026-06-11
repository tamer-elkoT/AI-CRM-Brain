"""epic1_schema_fixes_and_analytics

Revision ID: 02c0bc20d42b
Revises: 
Create Date: 2026-06-09 11:20:59.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '02c0bc20d42b'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- users table ---
    op.add_column('users', sa.Column('username', sa.String(length=100), nullable=True))
    op.add_column('users', sa.Column('account_name', sa.String(length=255), nullable=True))
    op.create_index(op.f('ix_users_username'), 'users', ['username'], unique=True)
    
    # Migrate existing legacy roles to new values
    op.execute("UPDATE users SET role = 'sales_rep' WHERE role = 'Sales'")
    op.execute("UPDATE users SET role = 'client' WHERE role = 'Client'")
    op.alter_column('users', 'role', server_default='sales_rep')

    # --- zoho_deals table ---
    op.add_column('zoho_deals', sa.Column('created_at', sa.DateTime(timezone=True), nullable=True))
    
    # Set custom_fields server_default to '{}'
    op.alter_column('zoho_deals', 'custom_fields', server_default=sa.text("'{}'::jsonb"))
    # Also update any existing null custom_fields to avoid errors down the line
    op.execute("UPDATE zoho_deals SET custom_fields = '{}'::jsonb WHERE custom_fields IS NULL")

    # --- llm_recommendations table ---
    # Fix any existing nulls first before adding the NOT NULL constraint
    op.execute("UPDATE llm_recommendations SET rep_action_taken = false WHERE rep_action_taken IS NULL")
    op.alter_column('llm_recommendations', 'rep_action_taken', 
                    existing_type=sa.BOOLEAN(),
                    nullable=False,
                    server_default=sa.text('false'))


def downgrade() -> None:
    # --- llm_recommendations ---
    op.alter_column('llm_recommendations', 'rep_action_taken',
                    existing_type=sa.BOOLEAN(),
                    nullable=True,
                    server_default=None)

    # --- zoho_deals ---
    op.alter_column('zoho_deals', 'custom_fields', server_default=None)
    op.drop_column('zoho_deals', 'created_at')

    # --- users ---
    op.alter_column('users', 'role', server_default='Sales')
    op.execute("UPDATE users SET role = 'Sales' WHERE role = 'sales_rep'")
    op.execute("UPDATE users SET role = 'Client' WHERE role = 'client'")
    
    op.drop_index(op.f('ix_users_username'), table_name='users')
    op.drop_column('users', 'account_name')
    op.drop_column('users', 'username')
