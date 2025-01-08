declare class ZmodemSentry {
    consume(input: number[] | ArrayBuffer): void;
    constructor(options: {
        to_terminal: Function;
        on_detect: Function;
        on_retract: Function;
        sender: Function;
    });
}
declare class ZmodemSession {
    on(evt_name: string, todo: Function): this;
    close(): Promise<any>;
    start(): Promise<any>;
}
declare class Detection {
    deny(...args: any[]): any;
    confirm(...args: any[]): any;
}
type FileDetails = {
    name: string;
    size?: number | undefined;
    mode?: number | undefined;
    mtime?: number | Date | undefined;
    files_remaining?: number | undefined;
    bytes_remaining?: number | undefined;
};
declare class Offer {
    get_details(): FileDetails;
    get_offset: () => number;
}
declare const Browser = {
    send_files(session: Zmodem.Session, files: FileList | any[], options?: {
        on_offer_response?: Function | undefined;
        on_progress?: Function | undefined;
        on_file_complete?: Function | undefined;
    }): Promise<any>;,
};
declare const ZMLIB = {};
declare const ENCODELIB = {};
declare const CRC = {};
declare const Text = {};
declare const Validation = {};
declare const DEBUG: boolean;
declare class ZDLE {}
declare class Error {}
declare class Header {}
declare class Subpacket {}
export {
    Browser,
    CRC,
    Detection,
    ENCODELIB,
    Error,
    FileDetails,
    Header,
    Offer,
    Subpacket,
    Text,
    Validation,
    ZDLE,
    ZMLIB,
    ZmodemSentry as Sentry,
    ZmodemSession as Session,
};
