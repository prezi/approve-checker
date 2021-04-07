"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TableCommentFormatter = exports.SimpleCommentFormatter = void 0;
class SimpleCommentFormatter {
    format(data) {
        return data.reduce((prev, curr) => prev + `- ${curr.path}: ${curr.users}\n`, "");
    }
}
exports.SimpleCommentFormatter = SimpleCommentFormatter;
class TableCommentFormatter {
    format(data) {
        return data.reduce((prev, curr) => prev + `|${curr.path}| ${curr.users.reduce((prev, curr) => prev + curr + '<br>')}\n`, "");
    }
}
exports.TableCommentFormatter = TableCommentFormatter;
