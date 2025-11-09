
import axios from "axios";
import Redis from "ioredis";


import { getDatabaseCredentials } from "../loaders/DatabaseLoader";
// import * as Punishments from "../database/Punishments";
import { write_to_logs } from "../cache/Logger";

/**
 * Look for any events that have a key space notation for redis
 * @param e - string 
 * @param r - string
 */
export function KeyspaceNotif(e: any, r: any): void {

    const sub_client: Redis = new Redis(getDatabaseCredentials("redis"));
    const expired_key: string = `__keyevent@0__:expired`;

    sub_client.subscribe(expired_key, () => {
        sub_client.on('message', async (channel: string, msg: string | any) => {
            
            const split_identifier: Array<string> = msg.split(":");
            const identifier: string = split_identifier[0];

            switch (identifier) {
                default:
                    break;
            }

        })
    });

}
