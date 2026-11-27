#![no_std]

mod admin;
mod events;
mod policy;
mod register;
mod report;
mod storage;
mod types;

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, Address, Env, Vec};

use types::{Error, WatchPolicy};

#[contract]
pub struct Registry;

// `lib.rs` is wiring only. Logic lives in the modules above so each one can be
// tested without reading a 900-line file.
#[contractimpl]
impl Registry {
    pub fn init(env: Env, admin: Address) -> Result<(), Error> {
        admin::init(&env, admin)
    }

    pub fn admin(env: Env) -> Result<Address, Error> {
        admin::admin(&env)
    }

    pub fn keeper(env: Env) -> Result<Address, Error> {
        admin::keeper(&env)
    }

    pub fn set_keeper(env: Env, keeper: Address) -> Result<(), Error> {
        admin::set_keeper(&env, keeper)
    }

    pub fn transfer_admin(env: Env, new_admin: Address) -> Result<(), Error> {
        admin::transfer_admin(&env, new_admin)
    }

    pub fn count(env: Env) -> u32 {
        register::count(&env)
    }

    pub fn register(
        env: Env,
        owner: Address,
        target: Address,
        threshold: u32,
        extend_to: u32,
    ) -> Result<u32, Error> {
        register::register(&env, owner, target, threshold, extend_to)
    }

    pub fn get(env: Env, id: u32) -> Result<WatchPolicy, Error> {
        register::get(&env, id)
    }

    pub fn list(env: Env, page: u32, limit: u32) -> Vec<WatchPolicy> {
        register::list(&env, page, limit)
    }

    pub fn list_by_owner(env: Env, owner: Address) -> Vec<WatchPolicy> {
        register::list_by_owner(&env, owner)
    }

    pub fn update(env: Env, id: u32, threshold: u32, extend_to: u32) -> Result<(), Error> {
        policy::update(&env, id, threshold, extend_to)
    }

    pub fn pause(env: Env, id: u32) -> Result<(), Error> {
        policy::pause(&env, id)
    }

    pub fn resume(env: Env, id: u32) -> Result<(), Error> {
        policy::resume(&env, id)
    }

    pub fn remove(env: Env, id: u32) -> Result<(), Error> {
        policy::remove(&env, id)
    }

    pub fn report(env: Env, id: u32, extended_at: u32) -> Result<(), Error> {
        report::report(&env, id, extended_at)
    }
}
