//! One-time setup and the two privileged addresses: admin and keeper.

use soroban_sdk::{Address, Env};

use crate::{events, storage, types::Error};

pub fn init(env: &Env, admin: Address) -> Result<(), Error> {
    if storage::has_admin(env) {
        return Err(Error::AlreadyInitialized);
    }
    admin.require_auth();

    storage::set_admin(env, &admin);
    storage::set_count(env, 0);

    events::initialized(env, &admin);
    storage::bump_instance(env);
    Ok(())
}

pub fn admin(env: &Env) -> Result<Address, Error> {
    storage::require_admin(env)
}

pub fn keeper(env: &Env) -> Result<Address, Error> {
    storage::require_keeper(env)
}

pub fn set_keeper(env: &Env, keeper: Address) -> Result<(), Error> {
    let admin = storage::require_admin(env)?;
    admin.require_auth();

    storage::set_keeper(env, &keeper);

    events::keeper_set(env, &keeper);
    storage::bump_instance(env);
    Ok(())
}

pub fn transfer_admin(env: &Env, new_admin: Address) -> Result<(), Error> {
    let admin = storage::require_admin(env)?;
    admin.require_auth();

    storage::set_admin(env, &new_admin);

    events::admin_changed(env, &admin, &new_admin);
    storage::bump_instance(env);
    Ok(())
}
