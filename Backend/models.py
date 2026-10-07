from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "user"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    phone = Column(String, unique=True, index=True)
    username = Column(String, unique=True, index=True)
    display_name = Column(String)
    avatar_url = Column(String, nullable=True)
    last_seen = Column(DateTime, default=datetime.utcnow)

    # Relationships
    contacts = relationship("Contact", foreign_keys="Contact.user_id", back_populates="user")
    contacted_by = relationship("Contact", foreign_keys="Contact.contact_user_id", back_populates="contact_user")
    messages = relationship("Message", back_populates="sender")
    participants = relationship("ConversationParticipant", back_populates="user")
    receipts = relationship("MessageReceipt", back_populates="user")

class Contact(Base):
    __tablename__ = "contact"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("user.id"))
    contact_user_id = Column(Integer, ForeignKey("user.id"))

    user = relationship("User", foreign_keys=[user_id], back_populates="contacts")
    contact_user = relationship("User", foreign_keys=[contact_user_id], back_populates="contacted_by")

class Conversation(Base):
    __tablename__ = "conversation"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    is_group = Column(Boolean, default=False)
    name = Column(String, nullable=True)

    participants = relationship("ConversationParticipant", back_populates="conversation")
    messages = relationship("Message", back_populates="conversation")

class ConversationParticipant(Base):
    __tablename__ = "conversation_participant"
    user_id = Column(Integer, ForeignKey("user.id"), primary_key=True)
    conversation_id = Column(Integer, ForeignKey("conversation.id"), primary_key=True)
    role = Column(String, default="member") # e.g. admin, member

    user = relationship("User", back_populates="participants")
    conversation = relationship("Conversation", back_populates="participants")

class Message(Base):
    __tablename__ = "message"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    sender_id = Column(Integer, ForeignKey("user.id"))
    text = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    conversation_id = Column(Integer, ForeignKey("conversation.id"))

    sender = relationship("User", back_populates="messages")
    conversation = relationship("Conversation", back_populates="messages")
    receipts = relationship("MessageReceipt", back_populates="message")

class MessageReceipt(Base):
    __tablename__ = "message_receipt"
    message_id = Column(Integer, ForeignKey("message.id"), primary_key=True)
    user_id = Column(Integer, ForeignKey("user.id"), primary_key=True)
    status = Column(String, default="sent") # sent, delivered, read

    message = relationship("Message", back_populates="receipts")
    user = relationship("User", back_populates="receipts")
