declare function msg_test(seneca: any, spec: any): {
    (): Promise<void>;
    run: (seneca: any, spec: any, calls: any) => Promise<unknown>;
};
declare namespace msg_test {
    var MsgTest: typeof msg_test;
    var Joi: any;
    var LN: (t: any) => any;
}
export default msg_test;
