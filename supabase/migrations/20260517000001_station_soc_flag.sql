alter table stations
  add column if not exists stock_on_consignment boolean not null default false;
