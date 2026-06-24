-- Migrate Plinko to 13-slot symmetrical layout
USE lucky_arcade;

DELETE FROM probability_configs WHERE game_id = 1 AND config_key LIKE 'multiplier_%';

INSERT INTO probability_configs (game_id, config_key, config_value) VALUES
(1, 'slot_0', 8.0000),
(1, 'slot_1', 9.0000),
(1, 'slot_2', 9.0000),
(1, 'slot_3', 8.0000),
(1, 'slot_4', 7.0000),
(1, 'slot_5', 6.0000),
(1, 'slot_6', 3.0000),
(1, 'slot_7', 6.0000),
(1, 'slot_8', 7.0000),
(1, 'slot_9', 8.0000),
(1, 'slot_10', 9.0000),
(1, 'slot_11', 9.0000),
(1, 'slot_12', 8.0000)
ON DUPLICATE KEY UPDATE config_value = VALUES(config_value);
