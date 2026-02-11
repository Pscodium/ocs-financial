# Guia de Implementação do Backend

Este documento fornece exemplos de como implementar as rotas da API e estruturar o banco de dados para o sistema financeiro.

## 📊 Estrutura do Banco de Dados

### Tabela: `users`
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  nickname VARCHAR(100),
  profile_icon VARCHAR(500),
  role VARCHAR(50) DEFAULT 'user',
  status VARCHAR(50) DEFAULT 'active',
  verified_email BOOLEAN DEFAULT false,
  external_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Tabela: `auth_tokens`
```sql
CREATE TABLE auth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_auth_tokens_token ON auth_tokens(token);
CREATE INDEX idx_auth_tokens_user_id ON auth_tokens(user_id);
```

### Tabela: `months`
```sql
CREATE TABLE months (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  month_key VARCHAR(7) NOT NULL, -- formato "YYYY-MM"
  data JSONB NOT NULL, -- armazena o objeto MonthData completo
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, month_key)
);

CREATE INDEX idx_months_user_id ON months(user_id);
CREATE INDEX idx_months_month_key ON months(user_id, month_key);
```

### Estrutura do campo `data` (JSONB):
```json
{
  "monthKey": "2026-02",
  "categories": [
    {
      "id": "abc123",
      "name": "Contas Casa",
      "type": "bills",
      "splitBy": 2,
      "bills": [
        {
          "id": "xyz789",
          "name": "Água",
          "amount": 85.76,
          "paid": true,
          "categoryId": "abc123",
          "note": "Opcional"
        }
      ]
    }
  ]
}
```

---

## 🔐 Rota: POST /login

### Requisição:
```json
{
  "email": "peter-larson@hotmail.com",
  "password": "senha123"
}
```

### Resposta (200 OK):
```json
{
  "id": "4f2f5772-2626-4b62-8e06-4d4fe152c2c0",
  "profileIcon": "https://example.com/avatar.png",
  "nickname": "Pscodium",
  "external_id": null,
  "role": "owner",
  "status": "active",
  "firstName": "Peterson",
  "lastName": "Larson",
  "email": "peter-larson@hotmail.com",
  "verifiedEmail": false,
  "createdAt": "2025-07-03T22:18:32.000Z",
  "updatedAt": "2025-07-03T22:18:32.000Z",
  "token": "60409dc5-fcbf-43e7-bfb0-b3f29a749de0"
}
```

### Implementação (Node.js/Express):
```javascript
const express = require('express');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validação
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    // Buscar usuário
    const user = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (user.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const userData = user.rows[0];

    // Verificar senha
    const passwordMatch = await bcrypt.compare(password, userData.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Gerar token
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 dias

    await db.query(
      'INSERT INTO auth_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [userData.id, token, expiresAt]
    );

    // Retornar resposta
    res.json({
      id: userData.id,
      profileIcon: userData.profile_icon,
      nickname: userData.nickname,
      external_id: userData.external_id,
      role: userData.role,
      status: userData.status,
      firstName: userData.first_name,
      lastName: userData.last_name,
      email: userData.email,
      verifiedEmail: userData.verified_email,
      createdAt: userData.created_at,
      updatedAt: userData.updated_at,
      token: token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});
```

---

## 📅 Rota: GET /months

### Headers:
```
Authorization: Bearer 60409dc5-fcbf-43e7-bfb0-b3f29a749de0
```

### Resposta (200 OK):
```json
[
  {
    "monthKey": "2026-02",
    "categories": [
      {
        "id": "abc123",
        "name": "Contas Casa",
        "type": "bills",
        "splitBy": 2,
        "bills": [
          {
            "id": "xyz789",
            "name": "Água",
            "amount": 85.76,
            "paid": true,
            "categoryId": "abc123"
          }
        ]
      }
    ]
  },
  {
    "monthKey": "2026-01",
    "categories": [...]
  }
]
```

### Implementação:
```javascript
// Middleware de autenticação
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.substring(7);

    const result = await db.query(
      `SELECT t.*, u.* FROM auth_tokens t 
       JOIN users u ON t.user_id = u.id 
       WHERE t.token = $1 AND (t.expires_at IS NULL OR t.expires_at > NOW())`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Token inválido ou expirado' });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Erro de autenticação' });
  }
}

// Rota GET /months
app.get('/months', authenticate, async (req, res) => {
  try {
    const userId = req.user.user_id;

    const result = await db.query(
      'SELECT data FROM months WHERE user_id = $1 ORDER BY month_key DESC',
      [userId]
    );

    // Extrai apenas o campo 'data' de cada registro (que é o MonthData completo)
    const months = result.rows.map(row => row.data);

    res.json(months);
  } catch (error) {
    console.error('Get months error:', error);
    res.status(500).json({ error: 'Erro ao buscar meses' });
  }
});
```

---

## ➕ Rota: POST /months

### Headers:
```
Authorization: Bearer 60409dc5-fcbf-43e7-bfb0-b3f29a749de0
Content-Type: application/json
```

### Requisição:
```json
{
  "monthKey": "2026-03",
  "categories": [
    {
      "id": "abc123",
      "name": "Contas Casa",
      "type": "bills",
      "splitBy": 2,
      "bills": [
        {
          "id": "xyz789",
          "name": "Água",
          "amount": 85.76,
          "paid": false,
          "categoryId": "abc123"
        }
      ]
    }
  ]
}
```

### Resposta (201 Created):
```json
{
  "monthKey": "2026-03",
  "categories": [...]
}
```

### Implementação:
```javascript
app.post('/months', authenticate, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const monthData = req.body;

    // Validação
    if (!monthData.monthKey) {
      return res.status(400).json({ error: 'monthKey é obrigatório' });
    }

    // Validar formato monthKey (YYYY-MM)
    if (!/^\d{4}-\d{2}$/.test(monthData.monthKey)) {
      return res.status(400).json({ error: 'monthKey deve estar no formato YYYY-MM' });
    }

    // Verificar se já existe
    const existing = await db.query(
      'SELECT id FROM months WHERE user_id = $1 AND month_key = $2',
      [userId, monthData.monthKey]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Mês já existe' });
    }

    // Inserir novo mês
    await db.query(
      'INSERT INTO months (user_id, month_key, data) VALUES ($1, $2, $3)',
      [userId, monthData.monthKey, JSON.stringify(monthData)]
    );

    res.status(201).json(monthData);
  } catch (error) {
    console.error('Create month error:', error);
    res.status(500).json({ error: 'Erro ao criar mês' });
  }
});
```

---

## ✏️ Rota: PUT /months/:monthKey

### Headers:
```
Authorization: Bearer 60409dc5-fcbf-43e7-bfb0-b3f29a749de0
Content-Type: application/json
```

### URL:
```
PUT /months/2026-02
```

### Requisição:
```json
{
  "monthKey": "2026-02",
  "categories": [
    {
      "id": "abc123",
      "name": "Contas Casa",
      "type": "bills",
      "splitBy": 2,
      "bills": [
        {
          "id": "xyz789",
          "name": "Água",
          "amount": 95.50,
          "paid": true,
          "categoryId": "abc123"
        }
      ]
    }
  ]
}
```

### Resposta (200 OK):
```json
{
  "monthKey": "2026-02",
  "categories": [...]
}
```

### Implementação:
```javascript
app.put('/months/:monthKey', authenticate, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { monthKey } = req.params;
    const monthData = req.body;

    // Validação
    if (monthData.monthKey !== monthKey) {
      return res.status(400).json({ 
        error: 'monthKey no body deve corresponder ao monthKey na URL' 
      });
    }

    // Atualizar mês
    const result = await db.query(
      `UPDATE months 
       SET data = $1, updated_at = NOW() 
       WHERE user_id = $2 AND month_key = $3
       RETURNING data`,
      [JSON.stringify(monthData), userId, monthKey]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mês não encontrado' });
    }

    res.json(result.rows[0].data);
  } catch (error) {
    console.error('Update month error:', error);
    res.status(500).json({ error: 'Erro ao atualizar mês' });
  }
});
```

---

## 🔧 Dicas de Implementação

### 1. Estrutura completa do servidor (Express):
```javascript
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = process.env.PORT || 10000;

// Database connection
const db = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'finance_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

// Middleware
app.use(cors());
app.use(express.json());

// ... rotas aqui ...

app.listen(port, () => {
  console.log(`API rodando na porta ${port}`);
});
```

### 2. Script para criar usuário de teste:
```javascript
// scripts/create-test-user.js
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

async function createTestUser() {
  const db = new Pool({ /* conexão */ });
  
  const passwordHash = await bcrypt.hash('senha123', 10);
  
  const result = await db.query(
    `INSERT INTO users (
      email, password_hash, first_name, last_name, 
      nickname, role, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
    [
      'peter-larson@hotmail.com',
      passwordHash,
      'Peterson',
      'Larson',
      'Pscodium',
      'owner',
      'active'
    ]
  );
  
  console.log('Usuário criado:', result.rows[0]);
  await db.end();
}

createTestUser();
```

### 3. Variáveis de ambiente (.env):
```env
PORT=10000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=finance_db
DB_USER=postgres
DB_PASSWORD=sua_senha
NODE_ENV=development
```

### 4. Índices extras para performance:
```sql
-- Índice para busca rápida no JSONB
CREATE INDEX idx_months_data_month_key ON months USING gin ((data->'monthKey'));

-- Índice para busca de categorias
CREATE INDEX idx_months_data_categories ON months USING gin ((data->'categories'));
```

---

## 📚 Dependências necessárias (package.json):

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "pg": "^8.11.3",
    "bcrypt": "^5.1.1",
    "uuid": "^9.0.1",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

---

## 🚀 Como rodar:

```bash
# Instalar dependências
npm install

# Criar banco de dados
psql -U postgres -c "CREATE DATABASE finance_db;"

# Executar migrations (criar tabelas)
psql -U postgres -d finance_db -f migrations.sql

# Criar usuário de teste
node scripts/create-test-user.js

# Iniciar servidor
npm start
```

---

## ✅ Testando as rotas:

```bash
# Login
curl -X POST http://localhost:10000/login \
  -H "Content-Type: application/json" \
  -d '{"email":"peter-larson@hotmail.com","password":"senha123"}'

# Listar meses (substitua TOKEN pelo token recebido no login)
curl http://localhost:10000/months \
  -H "Authorization: Bearer TOKEN"

# Criar mês
curl -X POST http://localhost:10000/months \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"monthKey":"2026-03","categories":[]}'

# Atualizar mês
curl -X PUT http://localhost:10000/months/2026-03 \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"monthKey":"2026-03","categories":[...]}'
```
