# Deployment & Production Guidelines 🚀

This document outlines instructions for deploying the **Smart Current Bill Predictor** stack to production environments (AWS, Heroku, or Dockerized VPS nodes) and configuring enterprise security constraints.

---

## 1. Environment Variable Matrix

Configure these environment variables in your hosting dashboard:

| Variable | Scope | Production Setting | Purpose |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Backend | `postgresql://user:pass@host:5432/dbname` | Live PostgreSQL connection string |
| `SECRET_KEY` | Backend | Long cryptographic random hash string | Session encryption / JWT signing |
| `QR_SECRET` | Backend | High-entropy token verification key | Generates tamper-proof QR code signatures |
| `ADMIN_EMAIL` | Backend | `admin@smartbill.com` | Production primary admin username |
| `ADMIN_PASSWORD` | Backend | Strong secure password string | Admin authentication credential |
| `ALLOWED_ORIGINS` | Backend | `["https://yourfrontend.com"]` | Restricts API access via CORS |

---

## 2. Docker Swarm / Docker Compose Production Deployment

Deploy the entire stack with a single command to any cloud VPS (AWS EC2, DigitalOcean Droplet, Linode) running Docker:

1. Clone files to the server host.
2. Initialize environment parameters in `.env`.
3. Launch the container stack in detached mode:
   ```bash
   docker-compose -f docker-compose.yml up -d --build
   ```
4. Verify database indices and migrations are executed by checking backend containers:
   ```bash
   docker logs smart_bill_backend
   ```

---

## 3. Production PostgreSQL Security Hardening

When connecting to Amazon RDS or managed PostgreSQL:

1. **Enforce SSL/TLS**: Ensure the `DATABASE_URL` appends `?sslmode=require` to encrypt credentials and queries.
2. **Access Control**: Configure security groups/firewalls to restrict database access. Only the FastAPI backend container IP should have port `5432` ingress access.
3. **Database Indexing**: The `database/schema.sql` creates database indexes on lookups like `property_id`, `meter_number`, and `user_id`. Ensure these are preserved on production schemas to prevent database degradation.

---

## 4. HTTPS Security & Nginx Configuration

To secure communication, place the frontend and API services behind a reverse proxy (like Nginx) configuring Let's Encrypt SSL certificates:

```nginx
server {
    listen 80;
    server_name smartbill.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name smartbill.com;

    ssl_certificate /etc/letsencrypt/live/smartbill.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/smartbill.com/privkey.pem;

    # Frontend Static Assets
    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # API Proxy Link
    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 5. Security Features Implemented

* **JWT (JSON Web Tokens)**: Encodes user identifiers, expiration flags, and role permissions cryptographically. Decoded only with the server-side `SECRET_KEY`.
* **Password Hashing**: Utilizes bcrypt via `passlib[bcrypt]` to secure passwords prior to database insertion.
* **SQL Injection Protection**: SQLAlchemy ORM translates raw queries using parameter binding, safeguarding query structures from inputs tampering.
* **Tamper-Proof QR Codes**: QR codes bundle hashes built from serial numbers and private cryptographic signatures.
* **Graceful Failbacks**: OCR image parsers fall back to safe simulations if native drivers fail, keeping processing pipelines running.
