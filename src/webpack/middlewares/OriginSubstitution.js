const debug = require('../../util/debug').here(__filename);
const url = require('url');
const harmon = require('harmon');
const through = require('through');
const removeTrailingSlash = x => x.replace(/\/$/, '');
module.exports = function createOriginSubstitutionMiddleware(
    oldDomain,
    newDomain
) {
    const oldOrigin = removeTrailingSlash(url.format(oldDomain));
    const newOrigin = removeTrailingSlash(url.format(newDomain));
    const attributesToReplaceOrigin = ['href', 'src', 'style'].map(attr => ({
        query: `[${attr}*="${oldOrigin}"]`,
        func(node) {
            node.setAttribute(
                attr,
                node
                    .getAttribute(attr)
                    .split(oldOrigin)
                    .join(newOrigin)
            );
        }
    }));
    const tagsToReplaceOrigin = ['style'].map(query => ({
        query,
        func(node) {
            const stream = node.createStream();
            stream
                .pipe(
                    through(function(buf) {
                        this.queue(
                            buf
                                .toString()
                                .split(oldOrigin)
                                .join(newOrigin)
                        );
                    })
                )
                .pipe(stream);
        }
    }));
    debug(
        `replace ${oldOrigin} with ${newOrigin} in html`,
        attributesToReplaceOrigin
    );
    const allTransforms = [
        ...tagsToReplaceOrigin,
        ...attributesToReplaceOrigin
    ];
    return harmon([], allTransforms, true);
};
