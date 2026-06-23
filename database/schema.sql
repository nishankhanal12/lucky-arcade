-- Lucky Arcade LAN Event Platform - MySQL Schema
CREATE DATABASE IF NOT EXISTS lucky_arcade CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE lucky_arcade;

CREATE TABLE admins (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE players (
  id INT PRIMARY KEY AUTO_INCREMENT,
  display_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_display_name (display_name)
);

CREATE TABLE games (
  id INT PRIMARY KEY AUTO_INCREMENT,
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  image_url VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE game_sessions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  player_id INT NOT NULL,
  game_id INT NOT NULL,
  status ENUM('active', 'completed', 'abandoned') DEFAULT 'active',
  forced_outcome VARCHAR(50) NULL,
  predetermined_outcome JSON NULL,
  board_data JSON NULL,
  result JSON NULL,
  score INT DEFAULT 0,
  reward_amount DECIMAL(10,2) DEFAULT 0,
  reward_description VARCHAR(255) NULL,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMP NULL,
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (game_id) REFERENCES games(id),
  INDEX idx_status (status),
  INDEX idx_started (started_at)
);

CREATE TABLE rewards (
  id INT PRIMARY KEY AUTO_INCREMENT,
  game_id INT NOT NULL,
  milestone VARCHAR(100) NOT NULL,
  reward_type ENUM('coupon', 'rupees', 'jackpot') NOT NULL,
  reward_value DECIMAL(10,2) NOT NULL,
  description VARCHAR(255),
  FOREIGN KEY (game_id) REFERENCES games(id)
);

CREATE TABLE winner_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  player_id INT NOT NULL,
  game_id INT NOT NULL,
  session_id INT NULL,
  player_name VARCHAR(100) NOT NULL,
  game_name VARCHAR(100) NOT NULL,
  reward_description VARCHAR(255),
  reward_amount DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (game_id) REFERENCES games(id),
  INDEX idx_created (created_at DESC)
);

CREATE TABLE leaderboard (
  id INT PRIMARY KEY AUTO_INCREMENT,
  player_id INT NOT NULL,
  game_id INT NULL,
  player_name VARCHAR(100) NOT NULL,
  total_wins INT DEFAULT 0,
  total_score INT DEFAULT 0,
  total_games INT DEFAULT 0,
  total_winnings DECIMAL(10,2) DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id),
  UNIQUE KEY unique_player_game (player_id, game_id)
);

CREATE TABLE probability_configs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  game_id INT NOT NULL,
  config_key VARCHAR(100) NOT NULL,
  config_value DECIMAL(7,4) NOT NULL,
  FOREIGN KEY (game_id) REFERENCES games(id),
  UNIQUE KEY unique_game_key (game_id, config_key)
);

CREATE TABLE system_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT NOT NULL
);

CREATE TABLE analytics (
  id INT PRIMARY KEY AUTO_INCREMENT,
  metric_key VARCHAR(100) NOT NULL,
  metric_value DECIMAL(15,2) DEFAULT 0,
  recorded_at DATE NOT NULL,
  UNIQUE KEY unique_metric_date (metric_key, recorded_at)
);

CREATE TABLE custom_boards (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  difficulty ENUM('easy', 'medium', 'hard', 'custom') DEFAULT 'custom',
  board_data JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE forced_outcomes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  game_id INT NOT NULL,
  outcome VARCHAR(50) NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (game_id) REFERENCES games(id)
);

-- Seed data (admin password is set by backend seed script on first run)

INSERT INTO games (slug, name, description, image_url) VALUES
('plinko', 'Plinko Drop', 'Drop the ball through pegs and land on a multiplier slot!', '/images/plinko.png'),
('mango-quest', 'Mango Quest', 'Navigate the jungle grid — find mangos, avoid bombs!', '/images/mango.png'),
('green-tap-rush', 'Green Tap Rush', 'Tap the green tile before it disappears. Speed is everything!', '/images/tap-rush.png');

INSERT INTO system_settings (setting_key, setting_value) VALUES
('event_title', 'Lucky Arcade LAN Event 2026'),
('current_jackpot', '50000'),
('ticket_price', '50'),
('plinko_rtp', '80');

-- Plinko probabilities (game_id = 1)
INSERT INTO probability_configs (game_id, config_key, config_value) VALUES
(1, 'multiplier_0', 15.0000),
(1, 'multiplier_0.5', 20.0000),
(1, 'multiplier_1', 25.0000),
(1, 'multiplier_2', 18.0000),
(1, 'multiplier_5', 12.0000),
(1, 'multiplier_10', 7.0000),
(1, 'multiplier_50', 3.0000);

-- Mango Quest outcomes (game_id = 2)
INSERT INTO probability_configs (game_id, config_key, config_value) VALUES
(2, 'LOSE_BEFORE_5', 40.0000),
(2, 'REACH_5', 30.0000),
(2, 'REACH_7', 20.0000),
(2, 'REACH_10', 10.0000);

-- Green Tap Rush outcomes (game_id = 3)
INSERT INTO probability_configs (game_id, config_key, config_value) VALUES
(3, 'FAIL', 35.0000),
(3, 'REACH_10', 25.0000),
(3, 'REACH_20', 20.0000),
(3, 'REACH_30', 12.0000),
(3, 'REACH_40', 8.0000);

-- Tap Rush difficulty settings
INSERT INTO probability_configs (game_id, config_key, config_value) VALUES
(3, 'min_visibility_ms', 800.0000),
(3, 'max_visibility_ms', 2000.0000),
(3, 'tile_size', 1.0000),
(3, 'spawn_interval_ms', 500.0000),
(3, 'game_duration', 30.0000);

-- Rewards
INSERT INTO rewards (game_id, milestone, reward_type, reward_value, description) VALUES
(2, 'row_5', 'coupon', 0, 'Coupon Reward'),
(2, 'row_7', 'rupees', 1000, '1000 Rupees Reward'),
(2, 'row_10', 'jackpot', 2000, '2000 Rupees Jackpot'),
(3, 'taps_10', 'coupon', 0, 'Coupon'),
(3, 'taps_20', 'rupees', 500, '500 Rupees'),
(3, 'taps_30', 'rupees', 1000, '1000 Rupees'),
(3, 'taps_40', 'jackpot', 5000, 'Jackpot');
