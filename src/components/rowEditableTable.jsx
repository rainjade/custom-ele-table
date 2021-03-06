import * as tslib_1 from "tslib";
import { Component, Watch, Vue, Prop } from "vue-property-decorator";
import tools from "../tools/index";
import MyInput from "./input";
import Textarea from "./textarea";
import event from "../tools/event";
import fnModules from "../tools/fns";
import Toast from "./toast";
let RowEditableTable = class RowEditableTable extends Vue {
    constructor() {
        super(...arguments);
        this.ossTableHeader = [];
        this.ossTableData = []; //处理过表体
        this.onlyOneCellBodyArr = [];
        this.headerArr = [];
        this.bodyNotShowPropData = ["cell_id"];
        this.curTableData = [];
        this.curEditTdId = "";
        this.textAreaContent = "";
        this.isBodyEmpty = false; //表体是否无数据
        this.oneCellData = {
            code: "",
            key: ""
        };
    }
    //表头层级
    get headerClasses() {
        const arr = this.headerArr.map(item => item.classifyId);
        return [...new Set(arr)];
    }
    created() {
        event.on("textarea-change", (val) => {
            this.textAreaContent = val;
        });
        event.on(`inputChange-${this.$options.name}`, (val) => {
            if (Object.is(Number(val.value), NaN)) {
                event.emit("show-toast", {
                    text: "请输入数字"
                });
                return;
            }
            const _check = (obj) => {
                for (const [k, v] of Object.entries(obj)) {
                    if (val.prop === k) {
                        return true;
                    }
                    if (typeof v === "object") {
                        const flag = v.fnParms &&
                            v.fnParms.some(item => {
                                return (item[this.uniqueKey] === val.parentColumnId &&
                                    item.key === val.prop);
                            });
                        if (flag) {
                            return true;
                        }
                    }
                }
                return false;
            };
            //该数据变化后 受影响的
            const target_arr = this.curTableData.filter(item => item[this.uniqueKey] === val.parentColumnId || _check(item));
            //找到数据变化的那一行tr
            const _idx = this.curTableData.findIndex(item => item[this.uniqueKey] === val.parentColumnId);
            const _temp_oss = this.ossTableData.find(item => item[this.uniqueKey] === val.parentColumnId);
            const _temp = this.curTableData.find(item => item[this.uniqueKey] === val.parentColumnId);
            if (_idx !== -1) {
                if (typeof _temp[val.prop] === "object") {
                    this.$set(_temp, val.prop, Object.assign({}, _temp[val.prop], {
                        value: val.value
                    }));
                }
                else {
                    this.$set(_temp, val.prop, val.value);
                }
                this.$set(this.curTableData, _idx, _temp);
                this.$emit("TableDataChange", this.curTableData);
            }
            if (typeof _temp[val.prop] === "object") {
                this.$set(_temp_oss, val.prop, Object.assign(_temp_oss[val.prop], {
                    value: val.value
                }));
            }
            else {
                this.$set(_temp_oss, val.prop, val.value);
            }
            const _idx_oss = this.ossTableData.findIndex(item => item[this.uniqueKey] === val.parentColumnId);
            if (target_arr.length) {
                target_arr.forEach(item => {
                    for (const [k, v] of Object.entries(item)) {
                        if (typeof v === "object") {
                            if (v.fn && v.fnParms && v.fnParms.length) {
                                if (v.fnParms.some((_val) => _val.key === val.prop)) {
                                    //参数数值的数组
                                    const argsArr = v.fnParms.map((_val) => {
                                        return this.getValueFromColumn(_val.code, _val.key);
                                    });
                                    let f = v.fn;
                                    //加入浮点型计算
                                    const { floatAdd, floatMul, floatDiv } = tools;
                                    // console.log(k, v.code, fnModules[f], argsArr);
                                    if (fnModules[f]) {
                                        f = fnModules[f];
                                    }
                                    try {
                                        /**
                                         * 解析函数字符串，计算公式
                                         * TODO 性能不好 后期考虑用 new Function() @fsg 2018.8.16
                                         */
                                        let res = eval("(" + f + `)(${argsArr.toString()})`);
                                        if (["false", false].includes(res)) {
                                            event.emit("show-toast", {
                                                text: "公式运算错误,请检查"
                                            });
                                            return;
                                        }
                                        if (!Object.is(Number(res), NaN)) {
                                            res = Number(res).toFixed(3);
                                        }
                                        const flag = [
                                            "NaN%",
                                            "Infinity%",
                                            "NaN",
                                            "Infinity",
                                            false,
                                            "false"
                                        ].includes(res);
                                        //如果输入非数字或0则不变化
                                        if (flag) {
                                            this.$set(v, "value", "");
                                        }
                                        else {
                                            this.$set(v, "value", res);
                                        }
                                    }
                                    catch (err) {
                                        throw err;
                                    }
                                }
                            }
                        }
                    }
                });
                const copyCurTD = tools.deepCopy(this.curTableData);
                const copyOssTD = tools.deepCopy(this.ossTableData);
                //TODO
                target_arr.forEach(item => {
                    copyCurTD.forEach((_val, _index) => {
                        if (item[this.uniqueKey] === _val.code) {
                            this.$set(this.curTableData, _index, item);
                            const c_index = copyOssTD.findIndex(_item => _item[this.uniqueKey] === _val.code);
                            this.$set(this.ossTableData, c_index, Object.assign({}, this.ossTableData[c_index], item));
                        }
                    });
                });
            }
        });
    }
    onTableHeaderChange(val) {
        this.initData();
    }
    onTextContentChange(val) {
        const _idx = this.curTableData.findIndex(item => item[this.uniqueKey] === this.oneCellData.code);
        if (_idx !== -1) {
            const _temp = this.curTableData[_idx];
            this.$set(_temp, this.oneCellData.key, val);
            this.$set(this.curTableData, _idx, _temp);
        }
        this.$emit("TableDataChange", this.curTableData);
    }
    //匹配对应行的值
    getValueFromColumn(code, key) {
        const _target = this.curTableData.find(item => item[this.uniqueKey] === code);
        if (_target) {
            if (typeof _target[key] === "object") {
                return _target[key].value ? _target[key].value : 0;
            }
            else {
                return _target[key] ? _target[key] : 0;
            }
        }
        else {
            return "";
        }
    }
    //判断是否为数字，不是则输出0
    checkIfNum(n) {
        return !Object.is(Number(n), NaN) ? Number(n) : 0;
    }
    //检查表头是否存在一个单元格的项目
    initData() {
        this.headerArr = [];
        this.onlyOneCellBodyArr = [];
        const ossTableHeader = tools.deepCopy(this.tableHeader);
        this.ossTableData = tools.deepCopy(this.tableData);
        this.curTableData = tools.deepCopy(this.tableData);
        if (this.tableData.length && this.tableData[0][this.uniqueKey]) {
            this.oneCellData.code = this.tableData[0][this.uniqueKey];
        }
        this.isBodyEmpty = !this.ossTableData.length;
        this.bodyNotShowProps.map(item => {
            if (!this.bodyNotShowPropData.includes(item)) {
                this.bodyNotShowPropData.push(item);
            }
        });
        this.ossTableData.forEach(item => {
            if (!this.uniqueKey) {
                if (!item.cell_id) {
                    item.cell_id = tools.guid();
                }
            }
            else {
                if (!item.cell_id) {
                    item.cell_id = item[this.uniqueKey];
                }
            }
        });
        this.ossTableHeader = this.giveIdx2Item(ossTableHeader);
        this.ossTableHeader.forEach((item, idx) => {
            if (item.onlyOneCell) {
                const _temp = item;
                const _idx = this.onlyOneCellBodyArr.findIndex(i => i.key === _temp.key);
                if (_idx === -1) {
                    this.onlyOneCellBodyArr.push(_temp);
                    this.oneCellData.key = _temp.key;
                    if (this.tableData.length) {
                        this.textAreaContent = this.tableData[0][_temp.key];
                    }
                }
                setTimeout(() => {
                    this.ossTableHeader.splice(idx, 1);
                }, 0);
            }
        });
        this.getHeaderItemArr(this.ossTableHeader);
    }
    giveIdx2Item(arr, parentSortId = "", classifyId = 0) {
        return arr.map((v, idx) => {
            const item = {
                ...tools.deepCopy(v),
                sortIdx: "",
                classifyId: -1
            };
            if (!item.sortIdx) {
                item.sortIdx = (parentSortId ? parentSortId + "_" : "") + idx;
            }
            item.classifyId = classifyId;
            if (Reflect.has(item, "children") &&
                Reflect.get(item, "children").length) {
                item.children = this.giveIdx2Item(Reflect.get(v, "children"), item.sortIdx, classifyId + 1);
            }
            return item;
        });
        // return arr;
    }
    //返回header某项
    getHeaderItemArr(arr1) {
        const bianli = (arr) => {
            arr.forEach((item, idx) => {
                if (item.onlyOneCell) {
                    const _temp = item;
                    const _idx = this.onlyOneCellBodyArr.findIndex(i => i.key === _temp.key);
                    if (_idx === -1) {
                        this.onlyOneCellBodyArr.push(_temp);
                        this.oneCellData.key = _temp.key;
                        if (this.tableData.length) {
                            this.textAreaContent = this.tableData[0][_temp.key];
                        }
                    }
                    setTimeout(() => {
                        arr.splice(idx, 1);
                    }, 0);
                    return;
                }
                if (Reflect.has(item, "children") &&
                    Reflect.get(item, "children").length) {
                    const idx = this.headerArr.findIndex(val => val.title === item.title && val.sortIdx === item.sortIdx);
                    if (idx === -1) {
                        const _temp = tools.deepCopy(item);
                        delete _temp.children;
                        this.headerArr.push(_temp);
                    }
                    bianli(Reflect.get(item, "children"));
                }
                else {
                    const _idx = this.headerArr.findIndex(val => val.key === item.key);
                    if (_idx === -1) {
                        this.headerArr.push(item);
                    }
                }
            });
        };
        bianli(arr1);
    }
    //通过key查找表头
    getHeaderItemByKey(key) {
        const _temp = this.headerArr.find(item => item.key === key);
        return _temp;
    }
    //渲染只有一个单元格项的头部
    oneCellHeader() {
        const getOneCellHeaderArr = (origArr = this.onlyOneCellBodyArr, resArr = []) => {
            const arr = tools.deepCopy(origArr);
            arr.forEach(item => {
                const _temp = tools.deepCopy(item);
                delete _temp.children;
                resArr.push(_temp);
                if (Reflect.has(item, "children") &&
                    Reflect.get(item, "children").length) {
                    getOneCellHeaderArr(Reflect.get(item, "children"), resArr);
                }
            });
            return resArr;
        };
        const oneCellHeaderArr = getOneCellHeaderArr().filter(item => item.title);
        return (<div style={{ borderTop: `1px solid ${this.tableBorderColor}` }}>
        {oneCellHeaderArr.map(item => {
            return (<div id={item.title} style={{
                lineHeight: `${this.cellHeight * item.rowSpan}px`,
                borderRight: `1px solid ${this.tableBorderColor}`,
                borderBottom: `1px solid ${this.tableBorderColor}`,
                width: "300px",
                ...this.headerStyle
            }} class="flexBox Ellipsis">
              <span style={{ padding: "0 20px" }}>{item.title}</span>
            </div>);
        })}
      </div>);
    }
    //渲染只有一个单元格的项
    renderOneCellItem() {
        if (!this.onlyOneCellBodyArr.length) {
            return null;
        }
        return (<div class="flexBox flex-ver-box alItSt" style={{ width: "300px" }}>
        {this.oneCellHeader()}
        {this.onlyOneCellBodyArr.map(item => {
            return (<div class="flexBox flex-ver-box alItSt " style={{
                overflow: "hidden",
                border: `1px solid ${this.tableBorderColor}`,
                borderLeft: "none",
                borderTop: "none",
                width: "300px"
            }} key={item.key}>
              {this.isBodyEmpty ? null : (<Textarea addStyle={{
                height: `${this.ossTableData.length * 40 +
                    this.ossTableData.length -
                    1}px`,
                ...this.cellStyle
            }} propContent={this.textAreaContent} isReadonly={this.isReadOnly}/>)}
            </div>);
        })}
      </div>);
    }
    //渲染表body
    renderPanelBody() {
        //body有数据
        const renderBody = () => {
            return (<tbody style={{
                borderTop: `1px solid ${this.tableBorderColor}`
            }}>
          {this.ossTableData.map(item => {
                return this.renderTableColumn(item);
            })}
        </tbody>);
        };
        return (<div>
        <table style={{
            width: "100%",
            border: `1px solid ${this.tableBorderColor}`,
            borderBottom: "none",
            borderLeft: "none"
        }}>
          <thead>
            {this.headerClasses.map(val => {
            return (<tr style={{
                ...this.headerStyle,
                borderTop: `1px solid ${this.tableBorderColor}`
            }}>
                  {this.headerArr
                .filter(item => item.classifyId === val)
                .filter(item => item.title)
                .map((item, _idx) => {
                return this.renderHeader(item, _idx);
            })}
                </tr>);
        })}
          </thead>
          {renderBody()}
        </table>
      </div>);
    }
    getRowspan(cell) {
        return cell.rowSpan ? cell.rowSpan : 1;
    }
    //渲染表头
    renderHeader(item, _idx) {
        const common = {
            verticalAlign: "middle",
            borderLeft: `1px solid ${this.tableBorderColor}`
        };
        return (<th rowspan={this.getRowspan(item)} colspan={item.colSpan ? item.colSpan : 1} style={_idx === 0 &&
            this.isFirstThEableClick &&
            item.sortIdx === "0" &&
            item.classifyId === 0
            ? {
                ...common,
                ...this.firstThStyle,
                cursor: "pointer",
                height: `${this.cellHeight * this.getRowspan(item)}px`
            }
            : {
                ...common,
                height: `${this.cellHeight * this.getRowspan(item)}px`
            }} onClick={() => {
            if (!this.isFirstThEableClick ||
                _idx !== 0 ||
                item.sortIdx !== "0" ||
                item.classifyId !== 0) {
                return;
            }
            // 点击第一个th单元格触发事件
            this.firstThClickHandler();
        }}>
        <span>{item.title}</span>
      </th>);
    }
    //返回只有一个单元格的项的字段
    getOneCellItemByKey(key, arr = this.onlyOneCellBodyArr) {
        const temp = arr.find((item) => {
            if (item.key) {
                return item.key === key;
            }
            else if (item.children && item.children.length) {
                return this.getOneCellItemByKey(key, Reflect.get(item, "children"));
            }
        });
        return temp;
    }
    //单元格点击事件
    tdClickHandler(tableId) {
        //响应操作单元格传入的函数
        this.curEditTdId = tableId;
    }
    //排序A是否应该排在B前面 -1是1否
    isAfrontB(A, B) {
        if (!A || !B) {
            return 0;
        }
        const A_arr = A.split("_").map(item => Number(item));
        const B_arr = B.split("_").map(item => Number(item));
        const len = Math.min(...[A_arr.length, B_arr.length]);
        for (let i = 0; i < len; i++) {
            if (A_arr[i] - B_arr[i] > 0) {
                return 1;
            }
            else if (A_arr[i] - B_arr[i] < 0) {
                return -1;
            }
        }
        return 0;
    }
    //返回header某项的排列索引
    getHeaderItemSortIndex(target_key) {
        const _idx = this.headerArr.findIndex(item => item.key === target_key);
        if (_idx === -1) {
            // console.error(_idx, target_key);
            return "";
        }
        return this.headerArr[_idx].sortIdx;
    }
    //渲染表的每行
    renderTableColumn(colOptions) {
        const sortArr = Object.keys(colOptions)
            .filter(item => !this.bodyNotShowPropData.includes(item))
            .filter(item => item !== "undefined")
            .filter(item => !this.bodyNotShowPropData.includes(item))
            .filter(item => !this.getOneCellItemByKey(item))
            .sort((a, b) => {
            try {
                return this.isAfrontB(this.getHeaderItemSortIndex(a), this.getHeaderItemSortIndex(b));
            }
            catch (e) {
                throw e;
            }
        });
        // console.log("sortArr", sortArr);
        return (<tr style={{ width: "100%" }}>
        {sortArr.map((item, idx) => {
            const readonlyInput = (() => {
                const common = {
                    minWidth: "100px",
                    borderTop: "none",
                    borderBottom: "none",
                    borderLeft: `1px solid ${this.tableBorderColor}`,
                    borderRight: "none",
                    borderRadius: 0,
                    textAlign: "center",
                    ...this.cellStyle
                };
                return (<MyInput addStyle={colOptions[item].fn
                    ? {
                        ...common,
                        ...this.calcCellStyle
                    }
                    : {
                        ...common
                    }} parentColumnId={this.uniqueKey
                    ? colOptions[this.uniqueKey]
                        ? colOptions[this.uniqueKey]
                        : colOptions["table_id"]
                    : colOptions["table_id"]} componentName={this.$options.name} editPropName={item} isReadonly value={typeof colOptions[item] === "object"
                    ? colOptions[item].value
                    : colOptions[item]}/>);
            })();
            const editInput = (() => {
                return (<MyInput style={{ minWidth: "100px" }} addStyle={`td_id_${colOptions[this.uniqueKey]}_${item}_${idx}` !==
                    this.curEditTdId
                    ? {
                        borderTop: "none",
                        borderBottom: "none",
                        borderLeft: `1px solid ${this.tableBorderColor}`,
                        borderRight: "none",
                        borderRadius: 0,
                        textAlign: "center",
                        ...this.cellStyle
                    }
                    : {
                        textAlign: "center"
                    }} parentColumnId={this.uniqueKey
                    ? colOptions[this.uniqueKey]
                        ? colOptions[this.uniqueKey]
                        : colOptions["table_id"]
                    : colOptions["table_id"]} componentName={this.$options.name} editPropName={item} value={typeof colOptions[item] === "object"
                    ? colOptions[item].value
                    : colOptions[item]}/>);
            })();
            return this.bodyNotShowPropData.includes(item) ? null : (<td class="row-td " id={`td_id_${colOptions[this.uniqueKey]}_${item}_${idx}`} style={{
                borderBottom: `1px solid ${this.tableBorderColor}`,
                width: `${(1 / this.ossTableHeader.length) * 100}%`,
                verticalAlign: "middle"
            }} onClick={this.tdClickHandler.bind(this, `td_id_${colOptions[this.uniqueKey]}_${item}_${idx}`)}>
              {this.isReadOnly
                ? readonlyInput
                : this.getHeaderItemByKey(item) &&
                    this.getHeaderItemByKey(item).isCanEdit
                    ? typeof colOptions[item] === "object" &&
                        !colOptions[item].isCanEdit
                        ? readonlyInput
                        : editInput
                    : readonlyInput}
            </td>);
        })}
      </tr>);
    }
    render() {
        //body无数据
        const emptyBody = () => {
            return (<div class="flexBox" style={{
                height: "100px",
                border: `1px solid ${this.tableBorderColor}`
            }}>
          {this.bodyEmptyTips}
        </div>);
        };
        return (<section class="nui-scroll nui-scroll-x">
        <Toast />
        <div style={{ display: "flex" }}>
          <div class="flex-1">{this.renderPanelBody()}</div>
          <div style={{ width: "300px" }}>{this.renderOneCellItem()}</div>
        </div>
        {this.isBodyEmpty ? emptyBody() : null}
      </section>);
    }
};
tslib_1.__decorate([
    Prop({
        type: Array,
        default: []
    })
], RowEditableTable.prototype, "tableData", void 0);
tslib_1.__decorate([
    Prop({
        type: Array,
        default: []
    })
], RowEditableTable.prototype, "tableHeader", void 0);
tslib_1.__decorate([
    Prop({
        type: Array,
        default: []
    })
], RowEditableTable.prototype, "bodyNotShowProps", void 0);
tslib_1.__decorate([
    Prop({
        type: String,
        default: "#ddd"
    })
], RowEditableTable.prototype, "tableBorderColor", void 0);
tslib_1.__decorate([
    Prop({
        type: Number,
        default: 40
    })
], RowEditableTable.prototype, "cellHeight", void 0);
tslib_1.__decorate([
    Prop({
        type: String,
        default: ""
    })
], RowEditableTable.prototype, "uniqueKey", void 0);
tslib_1.__decorate([
    Prop({
        type: Function,
        default: () => null
    })
], RowEditableTable.prototype, "firstThClickHandler", void 0);
tslib_1.__decorate([
    Prop({
        type: Boolean,
        default: false
    })
], RowEditableTable.prototype, "isFirstThEableClick", void 0);
tslib_1.__decorate([
    Prop({
        type: Object,
        default: () => { }
    })
], RowEditableTable.prototype, "firstThStyle", void 0);
tslib_1.__decorate([
    Prop({
        type: Boolean,
        default: false
    })
], RowEditableTable.prototype, "isReadOnly", void 0);
tslib_1.__decorate([
    Prop({
        type: String,
        default: "暂无数据"
    })
], RowEditableTable.prototype, "bodyEmptyTips", void 0);
tslib_1.__decorate([
    Prop({
        type: Object,
        default: () => ({
            background: "rgb(230, 242, 246)",
            color: "#333"
        })
    })
], RowEditableTable.prototype, "headerStyle", void 0);
tslib_1.__decorate([
    Prop({
        type: Object,
        default: () => ({
            background: "#fff",
            color: "#333"
        })
    })
], RowEditableTable.prototype, "cellStyle", void 0);
tslib_1.__decorate([
    Prop({
        type: Object,
        default: () => ({
            background: "#999",
            color: "#fff"
        })
    })
], RowEditableTable.prototype, "calcCellStyle", void 0);
tslib_1.__decorate([
    Watch("tableHeader", {
        immediate: true
    })
], RowEditableTable.prototype, "onTableHeaderChange", null);
tslib_1.__decorate([
    Watch("textAreaContent", {
        deep: true
    })
], RowEditableTable.prototype, "onTextContentChange", null);
RowEditableTable = tslib_1.__decorate([
    Component({
        name: "RowEditableTable"
    })
], RowEditableTable);
export { RowEditableTable };
export default RowEditableTable;
