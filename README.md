# Signal Messaging

A real-time messaging application inspired by Signal and WhatsApp. It supports direct messaging, group conversations, typing indicators, and real-time message delivery/read receipts.

## 🌊 Flow & Architecture

The application follows a client-server architecture with real-time bidirectional communication.

1. **Authentication:** Users register and log in via the Frontend. The Backend handles authentication (JWT-based) and securely stores user credentials in the database.
2. **Real-time Connection:** Once authenticated, the Frontend establishes a WebSocket connection with the FastAPI Backend.
3. **Conversations & Contacts:** Users can add contacts, create 1-on-1 chats, or form group conversations.
4. **Messaging & Receipts:** 
   - Messages sent from the Frontend are stored in the SQLite database and relayed to the recipient(s) via WebSockets.
   - Message receipts (`sent`, `delivered`, `read`) are tracked and broadcasted back to the sender in real-time.
5. **Typing Indicators:** Typing events are transmitted via WebSockets to provide real-time UI feedback to participants in a conversation.

## 🛠️ Tech Stack

### Frontend
- **Framework:** Next.js (React)
- **Language:** TypeScript
- **Icons:** Lucide React
- **Tooling:** ESLint

### Backend
- **Framework:** FastAPI (Python)
- **Real-time Communication:** WebSockets
- **Database:** SQLite (managed via SQLAlchemy ORM)
- **Authentication:** PyJWT, Passlib (bcrypt)
- **Data Validation:** Pydantic

## 🚀 Setup for Project

### Prerequisites
- Node.js (v18+)
- Python (v3.9+)

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd Signal-Messaging
```

### 2. Backend Setup
Open a terminal and navigate to the `Backend` directory:
```bash
cd Backend
```

Create and activate a Python virtual environment:
```bash
# On Windows
python -m venv venv
venv\Scripts\activate

# On macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

Install the required Python dependencies:
```bash
pip install -r requirements.txt
```

Run the FastAPI development server:
```bash
uvicorn main:app --reload
```
The backend server will run on `http://127.0.0.1:8000`.

### 3. Frontend Setup
Open a new terminal and navigate to the `Frontend` directory:
```bash
cd Frontend
```

Install Node.js dependencies:
```bash
npm install
```

Run the Next.js development server:
```bash
npm run dev
```
The frontend application will run on `http://localhost:3000`.

## 📜 ER Diagram
Refer to `Signal Messaging ER.png` in the root directory for a visualization of the database schema and entity relationships.
