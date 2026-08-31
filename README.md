# Blockchain-Based Disaster Relief Inventory Tracker

A Web2 + Web3 hybrid application for tracking disaster relief supplies.
This project uses a React frontend, Spring Boot backend, **IPFS (Kubo) as the decentralized operational data store** (PostgreSQL is fully replaced), Python/FastAPI for Machine Learning decision support, and Ethereum (Hardhat/Sepolia) for immutable supply-chain verification.

## Project Structure
- `frontend/` - React SPA (TypeScript + Vite)
- `backend/` - Spring Boot REST APIs (IPFS-backed storage)
- `ml/` - Python FastAPI for Random Forest inference
- `blockchain/` - Hardhat environment for Solidity smart contracts
- `docs/` - Architecture and Design Documentation

## Running Locally

### 0. IPFS (required before the backend)
```bash
# Start the Kubo daemon (API on 5001, gateway on 8080)
ipfs daemon
```

### 1. Frontend
```bash
cd frontend
npm install
npm run dev   # http://localhost:5173 (proxies /api to backend :8081)
```

### 2. Backend
Requires the IPFS daemon running (see step 0). Configure `application.properties` or environment variables.
```bash
cd backend
./mvnw spring-boot:run   # http://localhost:8081
```

### 3. Blockchain
```bash
cd blockchain
npm install
npx hardhat node          # http://127.0.0.1:8545
npx hardhat run scripts/deploy.js --network localhost
```

### 4. ML Environment
```bash
cd ml
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload  # http://127.0.0.1:8000
```

## Ports
| Service | Port |
| :--- | :--- |
| IPFS API / gateway | 5001 / 8080 |
| Backend (Spring Boot) | 8081 |
| ML (FastAPI) | 8000 |
| Frontend (Vite) | 5173 |
| Hardhat node | 8545 |
