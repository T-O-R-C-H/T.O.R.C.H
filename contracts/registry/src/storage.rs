//! Typed storage access. Every write extends the TTL of the entry it touched:
//! a registry that archives itself is not a registry.

use soroban_sdk::{Address, Env, Vec};

use crate::types::{DataKey, Error, WatchPolicy, SELF_EXTEND_TO, SELF_THRESHOLD};

/// Instance storage shares one TTL with the contract instance and its code.
pub fn bump_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(SELF_THRESHOLD, SELF_EXTEND_TO);
}

pub fn has_admin(env: &Env) -> bool {
    env.storage().instance().has(&DataKey::Admin)
}

pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&DataKey::Admin, admin);
}

pub fn get_admin(env: &Env) -> Option<Address> {
    env.storage().instance().get(&DataKey::Admin)
}

pub fn require_admin(env: &Env) -> Result<Address, Error> {
    get_admin(env).ok_or(Error::NotInitialized)
}

pub fn set_keeper(env: &Env, keeper: &Address) {
    env.storage().instance().set(&DataKey::Keeper, keeper);
}

pub fn get_keeper(env: &Env) -> Option<Address> {
    env.storage().instance().get(&DataKey::Keeper)
}

pub fn require_keeper(env: &Env) -> Result<Address, Error> {
    get_keeper(env).ok_or(Error::NotInitialized)
}

pub fn count(env: &Env) -> u32 {
    env.storage().instance().get(&DataKey::Count).unwrap_or(0)
}

pub fn set_count(env: &Env, count: u32) {
    env.storage().instance().set(&DataKey::Count, &count);
}

pub fn put_policy(env: &Env, policy: &WatchPolicy) {
    let key = DataKey::Policy(policy.id);
    env.storage().persistent().set(&key, policy);
    env.storage()
        .persistent()
        .extend_ttl(&key, SELF_THRESHOLD, SELF_EXTEND_TO);
}

pub fn find_policy(env: &Env, id: u32) -> Option<WatchPolicy> {
    env.storage().persistent().get(&DataKey::Policy(id))
}

pub fn get_policy(env: &Env, id: u32) -> Result<WatchPolicy, Error> {
    find_policy(env, id).ok_or(Error::PolicyNotFound)
}

pub fn remove_policy(env: &Env, id: u32) {
    env.storage().persistent().remove(&DataKey::Policy(id));
}

pub fn owner_index(env: &Env, owner: &Address) -> Vec<u32> {
    env.storage()
        .persistent()
        .get(&DataKey::OwnerIndex(owner.clone()))
        .unwrap_or_else(|| Vec::new(env))
}

pub fn put_owner_index(env: &Env, owner: &Address, ids: &Vec<u32>) {
    let key = DataKey::OwnerIndex(owner.clone());
    env.storage().persistent().set(&key, ids);
    env.storage()
        .persistent()
        .extend_ttl(&key, SELF_THRESHOLD, SELF_EXTEND_TO);
}
