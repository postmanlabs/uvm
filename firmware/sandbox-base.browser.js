module.exports = `
(function (self) {
    var init = function (e) {
        self.removeEventListener('message', init);
        const __init_uvm = e && (e.__init_uvm || (e.data && e.data.__init_uvm));
        // eslint-disable-next-line no-eval
        (typeof __init_uvm === 'string') && eval(__init_uvm);
    };
    self.addEventListener('message', init);
}(self));
`;
