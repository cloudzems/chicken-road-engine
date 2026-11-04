CREATE DATABASE IF NOT EXISTS `chicken_road_db`;

use `chicken_road_db`;

CREATE TABLE
  IF NOT EXISTS `chicken_road_db`.`bets` (
    `id` int primary key auto_increment,
    `bet_id` varchar(255) NOT NULL,
    `match_id` varchar(255) NOT NULL,
    `user_id` varchar(255) NOT NULL,
    `bet_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `game_data` TEXT DEFAULT NULL,
    `bet_status` ENUM ('success', 'failed') NOT NULL,
    `bet_request` TEXT NOT NULL,
    `bet_response` TEXT NOT NULL,
    `bet_transaction_id` varchar(255) NOT NULL,
    `is_declared` INT DEFAULT 0,
    `win_status` TEXT DEFAULT NULL,
    `result_request` TEXT DEFAULT NULL,
    `result_status` ENUM ('success', 'pending') DEFAULT 'pending',
    `result_transaction_id` varchar(255) DEFAULT NULL,
    `win_amount` DECIMAL(10, 2) DEFAULT 0.00,
    `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  );

ALTER TABLE `chicken_road_db`.`bets` ADD INDEX `inx_bet_id` (`bet_id` ASC) INVISIBLE,
ADD INDEX `inx_match_id` (`match_id` ASC) INVISIBLE,
ADD INDEX `inx_user_id` (`user_id` ASC) INVISIBLE,
ADD INDEX `inx_bet_amount` (`bet_amount` ASC) INVISIBLE,
ADD INDEX `game_data` (`game_data` (255)) INVISIBLE,
ADD INDEX `inx_bet_status` (`bet_status` ASC) INVISIBLE,
ADD INDEX `inx_bet_request` (`bet_request` (300)) INVISIBLE,
ADD INDEX `inx_bet_response` (`bet_response` (250)) INVISIBLE,
ADD INDEX `inx_bet_transaction_id` (`bet_transaction_id` ASC) INVISIBLE,
ADD INDEX `inx_result_request` (`result_request` (150)) INVISIBLE,
ADD INDEX `inx_is_declared` (`is_declared` ASC) INVISIBLE,
ADD INDEX `idx_win_status` (`win_status` (255)) INVISIBLE,
ADD INDEX `inx_result_status` (`result_status` ASC) INVISIBLE,
ADD INDEX `inx_result_transaction_id` (`result_transaction_id` ASC) INVISIBLE,
ADD INDEX `inx_win_amount` (`win_amount` ASC) VISIBLE,
ADD INDEX `inx_created_at` (`created_at` ASC) VISIBLE,
ADD INDEX `inx_updated_at` (`updated_at` ASC) VISIBLE;

ALTER TABLE `chicken_road_db`.`bets` MODIFY COLUMN result_status ENUM ('success', 'pending') DEFAULT 'pending';