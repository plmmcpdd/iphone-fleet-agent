exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE clients (
      id text PRIMARY KEY,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE devices (
      id text PRIMARY KEY,
      client_id text NOT NULL REFERENCES clients(id),
      account_id text NOT NULL UNIQUE,
      network_assignment_id text NOT NULL UNIQUE,
      state text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE accounts (
      id text PRIMARY KEY,
      client_id text NOT NULL REFERENCES clients(id),
      assigned_device_id text NOT NULL UNIQUE REFERENCES devices(id),
      network_assignment_id text NOT NULL UNIQUE,
      state text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE network_assignments (
      id text PRIMARY KEY,
      client_id text NOT NULL REFERENCES clients(id),
      account_id text NOT NULL UNIQUE REFERENCES accounts(id),
      device_id text NOT NULL UNIQUE REFERENCES devices(id),
      state text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    ALTER TABLE devices
      ADD CONSTRAINT devices_account_fk FOREIGN KEY (account_id) REFERENCES accounts(id) DEFERRABLE INITIALLY DEFERRED,
      ADD CONSTRAINT devices_network_fk FOREIGN KEY (network_assignment_id) REFERENCES network_assignments(id) DEFERRABLE INITIALLY DEFERRED;
    ALTER TABLE accounts
      ADD CONSTRAINT accounts_network_fk FOREIGN KEY (network_assignment_id) REFERENCES network_assignments(id) DEFERRABLE INITIALLY DEFERRED;

    CREATE TABLE device_fencing (
      device_id text PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
      last_token bigint NOT NULL DEFAULT 0 CHECK (last_token >= 0)
    );

    CREATE TABLE device_leases (
      device_id text PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
      lease_id text NOT NULL UNIQUE,
      job_id text NOT NULL,
      client_id text NOT NULL REFERENCES clients(id),
      account_id text NOT NULL REFERENCES accounts(id),
      network_assignment_id text NOT NULL REFERENCES network_assignments(id),
      actor_id text NOT NULL,
      correlation_id text NOT NULL,
      fencing_token bigint NOT NULL CHECK (fencing_token > 0),
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX device_leases_expiry_idx ON device_leases (expires_at);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS device_leases;
    DROP TABLE IF EXISTS device_fencing;
    DROP TABLE IF EXISTS network_assignments CASCADE;
    DROP TABLE IF EXISTS accounts CASCADE;
    DROP TABLE IF EXISTS devices CASCADE;
    DROP TABLE IF EXISTS clients;
  `);
};
