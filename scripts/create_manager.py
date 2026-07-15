import uuid
from models.database import SessionLocal
from models.schema import User
from utils.security import get_password_hash

def main():
    db = SessionLocal()
    existing = db.query(User).filter(User.email == 'manager@aicrm.com').first()
    if not existing:
        manager = User(
            id=uuid.uuid4(),
            email='manager@aicrm.com',
            hashed_password=get_password_hash('password123'),
            name='Sales Manager',
            business_field='technology',
            role='sales_manager',
            phone_number='+1234567890',
        )
        db.add(manager)
        db.commit()
        print('Sales Manager created successfully!')
    else:
        print('Sales Manager already exists.')
    db.close()

if __name__ == '__main__':
    main()
