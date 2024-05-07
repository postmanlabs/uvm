module.exports = {
    isObject (subject) {
        return (typeof subject === 'object' && subject !== null);
    },

    isFunction (subject) {
        return (typeof subject === 'function');
    },

    randomNumber () {
        return ~~(Math.random() * 100000000);
    }
};
