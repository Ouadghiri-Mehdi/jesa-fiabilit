-- ============================================================
--  JESA Fiabilité — Schéma MySQL complet v2 (XAMPP / phpMyAdmin)
--  Procédure : phpMyAdmin > Importer > Choisir ce fichier > Exécuter
-- ============================================================

CREATE DATABASE IF NOT EXISTS jesa_fiabilite
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE jesa_fiabilite;

-- ============================================================
-- 1. SITES
-- ============================================================
CREATE TABLE IF NOT EXISTS sites (
  id   INT AUTO_INCREMENT PRIMARY KEY,
  nom  VARCHAR(100) NOT NULL,
  code VARCHAR(20)  NOT NULL UNIQUE   -- jorf | rabat | casa | khb
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO sites (nom, code) VALUES
  ('Jorf Lasfar', 'jorf'),
  ('Rabat',       'rabat'),
  ('Casablanca',  'casa'),
  ('Khouribga',   'khb');

-- ============================================================
-- 2. UTILISATEURS
-- ⚠  Mots de passe en CLAIR — FastAPI les hashera avec bcrypt
--    au premier appel de /auth/login ou /auth/init
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  username   VARCHAR(50)  NOT NULL UNIQUE,
  email      VARCHAR(150) NOT NULL UNIQUE,
  password   VARCHAR(255) NOT NULL,            -- hashé bcrypt par FastAPI
  nom        VARCHAR(100),
  prenom     VARCHAR(100),
  role       ENUM('admin','user','superadmin') DEFAULT 'user',
  site_id    INT,
  actif      TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO users (username, email, password, nom, prenom, role, site_id) VALUES
  ('mehdi',    'mehdi@jesa.ma',    '123', 'Ouadghiri', 'Mehdi',   'admin', (SELECT id FROM sites WHERE code='rabat')),
  ('chaimae',  'chaimae@jesa.ma',  '123', 'Hamdi',     'Chaimae', 'user',  (SELECT id FROM sites WHERE code='jorf')),
  ('casa',     'casa@jesa.ma',     '123', 'User',      'Casa',    'user',  (SELECT id FROM sites WHERE code='casa')),
  ('kherbiga', 'kherbiga@jesa.ma', '123', 'User',      'KHB',     'user',  (SELECT id FROM sites WHERE code='khb'));

-- ============================================================
-- 3. ÉQUIPEMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS equipements (
  id          VARCHAR(100) NOT NULL,
  designation VARCHAR(255),
  famille     VARCHAR(100),    -- Broyeur | Convoyeur | Pompe …
  entite      VARCHAR(100),    -- JCF1 | JCF2 | Casa-Industrie …
  site_id     INT,
  actif       TINYINT(1) DEFAULT 1,
  PRIMARY KEY (id),
  INDEX idx_site (site_id),
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO equipements (id, designation, famille, entite, site_id) VALUES
  ('BRY-B001', 'Broyeur B001',   'Broyeur',   'JCF1',           (SELECT id FROM sites WHERE code='jorf')),
  ('BRY-B002', 'Broyeur B002',   'Broyeur',   'JCF1',           (SELECT id FROM sites WHERE code='jorf')),
  ('BRY-B003', 'Broyeur B003',   'Broyeur',   'JCF2',           (SELECT id FROM sites WHERE code='jorf')),
  ('BRY-B004', 'Broyeur B004',   'Broyeur',   'JCF2',           (SELECT id FROM sites WHERE code='jorf')),
  ('BRY-B014', 'Broyeur B014',   'Broyeur',   'JCF2',           (SELECT id FROM sites WHERE code='jorf')),
  ('BRY-B016', 'Broyeur B016',   'Broyeur',   'Casa-Industrie', (SELECT id FROM sites WHERE code='casa')),
  ('CNV-C012', 'Convoyeur C012', 'Convoyeur', 'JCF1',           (SELECT id FROM sites WHERE code='jorf')),
  ('CNV-C018', 'Convoyeur C018', 'Convoyeur', 'Casa-Industrie', (SELECT id FROM sites WHERE code='casa')),
  ('CNV-C031', 'Convoyeur C031', 'Convoyeur', 'JCF3',           (SELECT id FROM sites WHERE code='jorf')),
  ('PMP-P041', 'Pompe P041',     'Pompe',     'JCF1',           (SELECT id FROM sites WHERE code='jorf')),
  ('PMP-P052', 'Pompe P052',     'Pompe',     'JCF1',           (SELECT id FROM sites WHERE code='jorf')),
  ('PMP-P061', 'Pompe P061',     'Pompe',     'Casa-Industrie', (SELECT id FROM sites WHERE code='casa')),
  ('PMP-P077', 'Pompe P077',     'Pompe',     'JCF3',           (SELECT id FROM sites WHERE code='jorf'));

-- ============================================================
-- 4. CAUSES D'ARRÊT (référentiel)
-- ============================================================
CREATE TABLE IF NOT EXISTS causes_arret (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  libelle   VARCHAR(500) NOT NULL,
  site_id   INT  DEFAULT NULL,   -- NULL = commun à tous les sites
  is_global TINYINT(1) DEFAULT 1,
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO causes_arret (libelle) VALUES
  ('fixation supportage pompe à bouillie AP02'),
  ('Débouchage de la rampe'),
  ('Arrêt de la tour - changement compensateur ref BP02'),
  ('Prise d''air - isolement par joints pleins'),
  ('Arrêt de la tour - changement compensateur ref BP03'),
  ('Arrêt de la tour - changement compensateur ref BP04'),
  ('Soudage buses détachées de la rampe'),
  ('Lavage toiles et changement capillaire'),
  ('Défaut eau de bourrage pompe de la tour'),
  ('Défaut eau de bourrage pompe ACP 28%'),
  ('Arrêt de la tour - déclenchement 425EBP01'),
  ('Arrêt de la tour - défaut débistat BP01'),
  ('Travaux d''entretien - tamponnage et séchage'),
  ('Travaux d''entretien - fuite vanne à bouillie HV169'),
  ('Titres bas d''acide 28% - qualité nouveau floculant'),
  ('Arrêt échelon K - saturation de stock'),
  ('Changement pompe de production 404KAP05'),
  ('Coupure électrique');

-- ============================================================
-- 5. PARTICIPANTS (référentiel)
-- ============================================================
CREATE TABLE IF NOT EXISTS participants_ref (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  nom      VARCHAR(100) NOT NULL,
  prenom   VARCHAR(100),
  fonction VARCHAR(150),
  site_id  INT DEFAULT NULL,
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO participants_ref (nom, fonction) VALUES
  ('Personne 1', 'Ingénieure Fiabilité'),
  ('Personne 2', 'Chef de Production'),
  ('Personne 3', 'Technicienne Maintenance'),
  ('Personne 4', 'Planificateur Maintenance'),
  ('Personne 5', 'Analyste Process');

-- ============================================================
-- 6. SEUILS TUM (1 ligne par site)
-- ============================================================
CREATE TABLE IF NOT EXISTS seuils (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  site_id      INT NOT NULL UNIQUE,
  n1_cumul     FLOAT DEFAULT 2,    -- h  → Quick Kaizen
  n1_frequence INT   DEFAULT 2,    -- nb → Quick Kaizen
  n1_horizon   INT   DEFAULT 30,   -- jours observation N1
  n2_cumul     FLOAT DEFAULT 4,    -- h  → Arbre de Causes
  n2_frequence INT   DEFAULT 3,    -- nb → Arbre de Causes
  n2_horizon   INT   DEFAULT 90,   -- jours observation N2
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO seuils (site_id, n1_cumul, n1_frequence, n1_horizon, n2_cumul, n2_frequence, n2_horizon)
SELECT id, 2, 2, 30, 4, 3, 90 FROM sites;

-- ============================================================
-- 7. ARRÊTS (données TUM)
--    id INT AUTO_INCREMENT — le backend génère l'ID (plus optimal)
-- ============================================================
CREATE TABLE IF NOT EXISTS arrets (
  id          INT AUTO_INCREMENT PRIMARY KEY,   -- ✅ INT au lieu de VARCHAR
  equip_id    VARCHAR(100) NOT NULL,
  site_id     INT          NOT NULL,
  start_time  DATETIME     NOT NULL,
  duration    FLOAT        NOT NULL DEFAULT 0,  -- heures
  cause       VARCHAR(500) DEFAULT NULL,
  zone        VARCHAR(100) DEFAULT NULL,
  designation VARCHAR(255) DEFAULT NULL,
  description TEXT         DEFAULT NULL,
  created_by  INT          DEFAULT NULL,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_equip_site (equip_id, site_id),
  INDEX idx_start_time (start_time),
  FOREIGN KEY (site_id)    REFERENCES sites(id)       ON DELETE RESTRICT,
  FOREIGN KEY (equip_id)   REFERENCES equipements(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES users(id)       ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 8. SESSIONS RCA
--    noeuds et participants gardés en JSON (suffisant maintenant)
--    → prévu pour migration vers tables dédiées (rca_noeuds) plus tard
-- ============================================================
CREATE TABLE IF NOT EXISTS rca_sessions (
  id               VARCHAR(50)  NOT NULL,        -- RCA-20260508-123 (ID métier visible dans l'UI)
  equip_id         VARCHAR(100) DEFAULT NULL,
  site_id          INT          NOT NULL,
  titre            VARCHAR(255) DEFAULT NULL,
  methode          ENUM('5why','kaizen') DEFAULT '5why',
  statut           ENUM('non-commencee','en-cours','cloturee') DEFAULT 'non-commencee',
  niveau           TINYINT      DEFAULT 2,        -- 1=N1 Kaizen | 2=N2 Arbre de Causes
  source           VARCHAR(50)  DEFAULT 'Manuel', -- 'TUM' | 'Manuel'
  responsable      VARCHAR(100) DEFAULT NULL,
  zone             VARCHAR(100) DEFAULT NULL,
  phenomene        TEXT         DEFAULT NULL,
  cause_arret      VARCHAR(500) DEFAULT NULL,
  date_ouverture   DATE         DEFAULT NULL,
  date_heure_debut DATETIME     DEFAULT NULL,
  date_heure_fin   DATETIME     DEFAULT NULL,
  temps_analyse    FLOAT        DEFAULT 0,        -- secondes (chrono live)
  cumul_arret      FLOAT        DEFAULT 0,
  frequence        INT          DEFAULT 0,
  taux_panne       FLOAT        DEFAULT 0,
  disponibilite    FLOAT        DEFAULT 100,
  participants     JSON         DEFAULT NULL,     -- [{ id, nom, fonction, recommandation, delai }]
  noeuds           JSON         DEFAULT NULL,     -- arbre 5why récursif → futur: table rca_noeuds
  created_by       INT          DEFAULT NULL,
  created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_equip_site (equip_id, site_id),
  INDEX idx_statut     (statut),
  INDEX idx_date_ouv   (date_ouverture),
  FOREIGN KEY (site_id)    REFERENCES sites(id)  ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES users(id)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 9. ACTIONS CORRECTIVES (table dédiée ✅)
--    Séparées de rca_sessions pour permettre filtres, retards, dashboard
-- ============================================================
CREATE TABLE IF NOT EXISTS rca_actions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  rca_id      VARCHAR(50)  NOT NULL,
  equip_id    VARCHAR(100) DEFAULT NULL,
  site_id     INT          NOT NULL,
  cause       TEXT         DEFAULT NULL,          -- cause racine associée
  action      TEXT         NOT NULL,              -- description de l'action
  responsable VARCHAR(100) DEFAULT NULL,
  delai       DATE         DEFAULT NULL,          -- date limite
  statut      ENUM('pas-commence','en-cours','retard','cloture') DEFAULT 'pas-commence',
  commentaire TEXT         DEFAULT NULL,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_rca    (rca_id),
  INDEX idx_statut (statut),
  INDEX idx_delai  (delai),
  FOREIGN KEY (rca_id)  REFERENCES rca_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (site_id) REFERENCES sites(id)         ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 10. DOCUMENTS (uploads fichiers)
-- ============================================================
CREATE TABLE IF NOT EXISTS documents (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  rca_id      VARCHAR(50)  DEFAULT NULL,   -- lié à une RCA (optionnel)
  equip_id    VARCHAR(100) DEFAULT NULL,   -- lié à un équipement (optionnel)
  site_id     INT          NOT NULL,
  file_name   VARCHAR(255) NOT NULL,
  file_path   VARCHAR(500) NOT NULL,       -- chemin relatif sur le serveur
  file_type   VARCHAR(50)  DEFAULT NULL,   -- pdf | image | xlsx | autre
  file_size   INT          DEFAULT 0,      -- octets
  uploaded_by INT          DEFAULT NULL,
  uploaded_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_rca   (rca_id),
  INDEX idx_equip (equip_id),
  FOREIGN KEY (rca_id)      REFERENCES rca_sessions(id) ON DELETE SET NULL,
  FOREIGN KEY (site_id)     REFERENCES sites(id)         ON DELETE RESTRICT,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)         ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 11. EMBEDDINGS IA (pour RAG / recherche sémantique)
--    MySQL 8.0 (XAMPP standard) : stockage JSON (tableau de floats)
--    MySQL 9.0+ : remplacer embedding_json par embedding VECTOR(1536)
-- ============================================================
CREATE TABLE IF NOT EXISTS rca_embeddings (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  rca_id         VARCHAR(50)  NOT NULL UNIQUE,
  model          VARCHAR(100) DEFAULT 'text-embedding-3-small',  -- modèle utilisé
  embedding_json JSON         NOT NULL,    -- [ 0.023, -0.14, … ] — 1536 floats
  -- Futur MySQL 9.0+ : embedding VECTOR(1536) NOT NULL
  created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (rca_id) REFERENCES rca_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- FIN DU SCRIPT — Schéma v2 complet
--
-- Tables créées :
--   sites | users | equipements | causes_arret | participants_ref
--   seuils | arrets | rca_sessions | rca_actions | documents | rca_embeddings
--
-- Prochaine étape : backend FastAPI (Python) avec :
--   - PyMySQL + SQLAlchemy pour la connexion MySQL
--   - passlib[bcrypt] pour hasher les mots de passe
--   - JWT (python-jose) pour l'authentification
-- ============================================================
