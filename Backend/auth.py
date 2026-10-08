import jwt
from datetime import datetime, timedelta
import json
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional

from database import get_db
import models

SECRET_KEY = "my_super_secret_mock_key_for_signal"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 7 days

router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/verify-otp")

class SendOTPRequest(BaseModel):
    identifier: str # Phone number or username

class VerifyOTPRequest(BaseModel):
    identifier: str
    otp: str

class ProfileUpdateRequest(BaseModel):
    display_name: str
    avatar_url: Optional[str] = None
    username: Optional[str] = None

class FirstMessageRequest(BaseModel):
    target_user_id: int
    text: str

class Token(BaseModel):
    access_token: str
    token_type: str

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except jwt.InvalidTokenError:
        raise credentials_exception
        
    user = db.query(models.User).filter(models.User.id == int(user_id)).first()
    if user is None:
        raise credentials_exception
    return user

@router.post("/send-otp")
def send_otp(req: SendOTPRequest):
    # Mocking real phone verification and crypto key exchange
    return {"message": "OTP sent successfully. Use 123456 to verify. Key exchange mocked."}

@router.post("/verify-otp", response_model=Token)
def verify_otp(req: VerifyOTPRequest, db: Session = Depends(get_db)):
    if req.otp != "123456":
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    is_phone = req.identifier.startswith("+") or req.identifier.replace("-", "").isdigit()
    
    if is_phone:
        user = db.query(models.User).filter(models.User.phone == req.identifier).first()
    else:
        user = db.query(models.User).filter(models.User.username == req.identifier).first()

    if not user:
        user = models.User()
        if is_phone:
            user.phone = req.identifier
        else:
            user.username = req.identifier
        db.add(user)
        db.commit()
        db.refresh(user)

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/profile")
def update_profile(req: ProfileUpdateRequest, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if req.username != current_user.username:
        if req.username is not None:
            existing_user = db.query(models.User).filter(func.lower(models.User.username) == req.username.lower()).first()
            if existing_user:
                raise HTTPException(status_code=400, detail="Username already exists")
        current_user.username = req.username

    current_user.display_name = req.display_name
    if req.avatar_url is not None:
        current_user.avatar_url = req.avatar_url
    db.commit()
    db.refresh(current_user)
    return {"message": "Profile updated", "display_name": current_user.display_name, "avatar_url": current_user.avatar_url, "username": current_user.username}

@router.get("/me")
def get_me(current_user: models.User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "phone": current_user.phone,
        "username": current_user.username,
        "display_name": current_user.display_name,
        "avatar_url": current_user.avatar_url
    }

@router.get("/search")
def search_users(query: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not query or len(query) < 2:
        return []
    
    results = db.query(models.User).filter(
        models.User.username.ilike(f"%{query}%"),
        models.User.id != current_user.id,
        models.User.username != None
    ).limit(20).all()
    
    return [
        {
            "id": u.id,
            "username": u.username,
            "display_name": u.display_name,
            "avatar_url": u.avatar_url
        }
        for u in results
    ]

async def send_ws_notification(target_user_id: int, payload: dict):
    from ws_manager import manager
    await manager.send_personal_message(json.dumps(payload), target_user_id)

@router.post("/message/first")
def send_first_message(req: FirstMessageRequest, background_tasks: BackgroundTasks, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if req.target_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot send message to yourself")
    
    # Verify the target user exists
    target_user = db.query(models.User).filter(models.User.id == req.target_user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found")
        
    try:
        # 1. CONTACT: Insert a row in the Contact table mapping current user to target user
        contact = models.Contact(user_id=current_user.id, contact_user_id=target_user.id)
        db.add(contact)
        
        # 2. CONVERSATION: Create a new Conversation record
        conversation = models.Conversation(is_group=False)
        db.add(conversation)
        db.flush() # Flush to get the generated conversation.id
        
        # 3. CONVERSATION_PARTICIPANT: Insert two participant records
        part1 = models.ConversationParticipant(user_id=current_user.id, conversation_id=conversation.id, role="member")
        part2 = models.ConversationParticipant(user_id=target_user.id, conversation_id=conversation.id, role="member")
        db.add(part1)
        db.add(part2)
        
        # 4. MESSAGE: Create the actual Message record
        message = models.Message(sender_id=current_user.id, conversation_id=conversation.id, text=req.text)
        db.add(message)
        db.flush() # Flush to get the generated message.id
        
        # 5. MESSAGE_RECEIPT: Create a MessageReceipt record for the TARGET user
        receipt = models.MessageReceipt(message_id=message.id, user_id=target_user.id, status="sent")
        db.add(receipt)
        
        # Commit the transaction if all steps succeeded
        db.commit()
        
        # Dispatch websocket notification
        payload = {
            "type": "new_message",
            "message": {
                "id": message.id,
                "text": message.text,
                "sender_id": current_user.id,
                "conversation_id": conversation.id,
                "sender_name": current_user.display_name or current_user.username
            }
        }
        background_tasks.add_task(send_ws_notification, target_user.id, payload)
        
        return {"message": "First message sent successfully", "conversation_id": conversation.id}
        
    except Exception as e:
        # 6. ERROR HANDLING: Rollback the transaction on failure
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create conversation and send message: {str(e)}")

@router.get("/chats")
def get_user_chats(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Get all conversation participants for the current user
    user_participations = db.query(models.ConversationParticipant).filter(
        models.ConversationParticipant.user_id == current_user.id
    ).all()
    
    chats_dict = {}
    
    for p in user_participations:
        conversation = p.conversation
        if not conversation.is_group:
            # Find the other participant
            other_p = db.query(models.ConversationParticipant).filter(
                models.ConversationParticipant.conversation_id == conversation.id,
                models.ConversationParticipant.user_id != current_user.id
            ).first()
            
            if other_p:
                other_user = other_p.user
                
                # Get the latest message for THIS conversation
                last_msg = db.query(models.Message).filter(
                    models.Message.conversation_id == conversation.id
                ).order_by(models.Message.created_at.desc()).first()
                
                if other_user.id not in chats_dict:
                    chats_dict[other_user.id] = {
                        "id": other_user.id,
                        "conversation_id": conversation.id,
                        "name": other_user.display_name or other_user.username or "Unknown",
                        "initial": (other_user.display_name or other_user.username or "?")[0].upper(),
                        "avatar_url": other_user.avatar_url,
                        "last_message": last_msg.text if last_msg else None,
                        "last_message_time": last_msg.created_at.strftime("%H:%M") if last_msg else None,
                        "_last_msg_obj": last_msg
                    }
                else:
                    # Update if this conversation has a newer message
                    existing_msg = chats_dict[other_user.id]["_last_msg_obj"]
                    if last_msg:
                        if not existing_msg or last_msg.created_at > existing_msg.created_at:
                            chats_dict[other_user.id]["last_message"] = last_msg.text
                            chats_dict[other_user.id]["last_message_time"] = last_msg.created_at.strftime("%H:%M")
                            chats_dict[other_user.id]["_last_msg_obj"] = last_msg
                            chats_dict[other_user.id]["conversation_id"] = conversation.id
                            
    # Clean up and sort by time
    final_chats = []
    for uid, data in chats_dict.items():
        del data["_last_msg_obj"]
        final_chats.append(data)
        
    final_chats.sort(key=lambda x: x["last_message_time"] or "", reverse=True)
    
    return final_chats

@router.get("/messages/{target_user_id}")
def get_conversation_messages(target_user_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Find all conversations shared by current_user and target_user
    user1_convs = set(p.conversation_id for p in db.query(models.ConversationParticipant).filter(models.ConversationParticipant.user_id == current_user.id).all())
    user2_convs = set(p.conversation_id for p in db.query(models.ConversationParticipant).filter(models.ConversationParticipant.user_id == target_user_id).all())
    
    shared_convs = user1_convs.intersection(user2_convs)
    
    if not shared_convs:
        return []
        
    messages = db.query(models.Message).filter(
        models.Message.conversation_id.in_(shared_convs)
    ).order_by(models.Message.created_at.asc()).all()
    
    return [
        {
            "id": m.id,
            "text": m.text,
            "sender_id": m.sender_id,
            "out": m.sender_id == current_user.id,
            "time": m.created_at.strftime("%H:%M")
        } for m in messages
    ]
