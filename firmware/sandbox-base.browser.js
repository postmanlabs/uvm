module.exports = `
(function (self) {
    var init = function (e) {
        self.removeEventListener('message', init);
        const __init_uvm = e?.data?.__init_uvm;
        (typeof __init_uvm === 'string') && eval(__init_uvm);
    };
    self.addEventListener('message', init);
}(self));
`;
