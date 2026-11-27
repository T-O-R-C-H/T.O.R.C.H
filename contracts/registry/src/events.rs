//! Events. Topics carry the symbol and, where useful, the policy id, so an
//! indexer can filter without decoding data.

use soroban_sdk::{contractevent, Address, Env};

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Initialized {
    #[topic]
    pub admin: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct KeeperSet {
    #[topic]
    pub keeper: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdminChanged {
    pub old: Address,
    pub new: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Registered {
    #[topic]
    pub id: u32,
    pub owner: Address,
    pub target: Address,
    pub threshold: u32,
    pub extend_to: u32,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Updated {
    #[topic]
    pub id: u32,
    pub threshold: u32,
    pub extend_to: u32,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Paused {
    #[topic]
    pub id: u32,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Resumed {
    #[topic]
    pub id: u32,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Removed {
    #[topic]
    pub id: u32,
    pub owner: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Extended {
    #[topic]
    pub id: u32,
    pub extended_at: u32,
}

pub fn initialized(env: &Env, admin: &Address) {
    Initialized {
        admin: admin.clone(),
    }
    .publish(env);
}

pub fn keeper_set(env: &Env, keeper: &Address) {
    KeeperSet {
        keeper: keeper.clone(),
    }
    .publish(env);
}

pub fn admin_changed(env: &Env, old: &Address, new: &Address) {
    AdminChanged {
        old: old.clone(),
        new: new.clone(),
    }
    .publish(env);
}

pub fn registered(
    env: &Env,
    id: u32,
    owner: &Address,
    target: &Address,
    threshold: u32,
    extend_to: u32,
) {
    Registered {
        id,
        owner: owner.clone(),
        target: target.clone(),
        threshold,
        extend_to,
    }
    .publish(env);
}

pub fn updated(env: &Env, id: u32, threshold: u32, extend_to: u32) {
    Updated {
        id,
        threshold,
        extend_to,
    }
    .publish(env);
}

pub fn paused(env: &Env, id: u32) {
    Paused { id }.publish(env);
}

pub fn resumed(env: &Env, id: u32) {
    Resumed { id }.publish(env);
}

pub fn removed(env: &Env, id: u32, owner: &Address) {
    Removed {
        id,
        owner: owner.clone(),
    }
    .publish(env);
}

pub fn extended(env: &Env, id: u32, extended_at: u32) {
    Extended { id, extended_at }.publish(env);
}
