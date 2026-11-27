//! Policy lifecycle. Every function here authorizes the policy owner — never
//! the admin, never the target.

use soroban_sdk::{Env, Vec};

use crate::{
    events, register, storage,
    types::{Error, WatchPolicy},
};

fn load_owned(env: &Env, id: u32) -> Result<WatchPolicy, Error> {
    let policy = storage::get_policy(env, id)?;
    policy.owner.require_auth();
    Ok(policy)
}

pub fn update(env: &Env, id: u32, threshold: u32, extend_to: u32) -> Result<(), Error> {
    let mut policy = load_owned(env, id)?;
    register::validate(threshold, extend_to)?;

    policy.threshold = threshold;
    policy.extend_to = extend_to;
    storage::put_policy(env, &policy);

    events::updated(env, id, threshold, extend_to);
    storage::bump_instance(env);
    Ok(())
}

pub fn pause(env: &Env, id: u32) -> Result<(), Error> {
    let mut policy = load_owned(env, id)?;

    policy.active = false;
    storage::put_policy(env, &policy);

    events::paused(env, id);
    storage::bump_instance(env);
    Ok(())
}

pub fn resume(env: &Env, id: u32) -> Result<(), Error> {
    let mut policy = load_owned(env, id)?;

    policy.active = true;
    storage::put_policy(env, &policy);

    events::resumed(env, id);
    storage::bump_instance(env);
    Ok(())
}

/// Deletes the policy and its index entry. The id is not reissued: `count` stays
/// where it was, so a stale link in a dashboard 404s instead of showing another
/// team's contract.
pub fn remove(env: &Env, id: u32) -> Result<(), Error> {
    let policy = load_owned(env, id)?;

    storage::remove_policy(env, id);

    let ids = storage::owner_index(env, &policy.owner);
    let mut kept = Vec::new(env);
    let mut i = 0;
    while i < ids.len() {
        if let Some(existing) = ids.get(i) {
            if existing != id {
                kept.push_back(existing);
            }
        }
        i += 1;
    }
    storage::put_owner_index(env, &policy.owner, &kept);

    events::removed(env, id, &policy.owner);
    storage::bump_instance(env);
    Ok(())
}
