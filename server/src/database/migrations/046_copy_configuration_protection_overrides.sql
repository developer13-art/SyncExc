ALTER TABLE copy_configurations
    ADD COLUMN stop_loss_percent numeric(7, 4),
    ADD COLUMN take_profit_percent numeric(7, 4),
    ADD CONSTRAINT copy_configurations_stop_loss_percent_check
        CHECK (stop_loss_percent IS NULL OR (stop_loss_percent > 0 AND stop_loss_percent < 100)),
    ADD CONSTRAINT copy_configurations_take_profit_percent_check
        CHECK (take_profit_percent IS NULL OR (take_profit_percent > 0 AND take_profit_percent < 100));
