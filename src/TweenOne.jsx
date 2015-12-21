import React, {PropTypes,Component} from 'react';
import ReactDom from 'react-dom';
import assign from 'object-assign';
import easingTypes from 'tween-functions';
import requestAnimationFrame from 'raf';
import { DataToArray } from './util';
import Css from './Css';

const DEFAULT_EASING = 'easeInOutQuad';
const DEFAULT_DURATION = 450;
const DEFAULT_DELAY = 0;

function noop() {
}

function DefaultData(vars, now) {
  return {
    duration: vars.duration || vars.duration === 0 ? vars.duration : DEFAULT_DURATION,
    delay: vars.delay || DEFAULT_DELAY,
    ease: vars.ease || DEFAULT_EASING,
    onUpdate: vars.onUpdate || noop,
    onComplete: vars.onComplete || noop,
    onStart: vars.onStart || noop,
    onRepeat: vars.onRepeat || noop,
    repeat: vars.repeat || 0,
    repeatDelay: vars.repeatDelay || 0,
    repeatAnnal: 1,
    yoyo: vars.yoyo || false,
    initTime: now,
  }
}

class TweenOne extends Component {
  setDefaultData(_vars) {
    const vars = DataToArray(_vars);
    this.defaultData = [];
    this.tweenStart = {};
    let now = Date.now();
    vars.forEach((item)=> {
      now += (item.delay || 0);//加上延时
      const tweenData = DefaultData(item, now);
      tweenData.tween = {};
      for (let p in item) {
        if (!(p in tweenData)) {
          tweenData.tween[p] = item[p];
        }
      }
      if (tweenData.yoyo && !tweenData.repeat) {
        console.warn('Warning: yoyo must be used together with repeat;')
      }
      now += (item.duration || DEFAULT_DURATION );//加上此时用的时间，遍历下个时要用
      this.defaultData.push(tweenData);
    });
  }

  constructor() {
    super(...arguments);
    this.rafID = null;
    this.style = {};
    this.setDefaultData(this.props.vars || {});
    this.state = {
      style: {}
    };
    [
      'raf'
    ].forEach((method) => this[method] = this[method].bind(this));
  }


  raf() {
    if (this.rafID === -1) {
      return;
    }
    const newStyle = this.style;
    let matrixObj = {};
    let matrixBool = false;
    this.defaultData.forEach((item, i)=> {
      if (!item) {
        return;
      }
      const now = Date.now();
      const progressTime = now - item.initTime > item.duration ? item.duration : now - item.initTime;
      let start, end, startData, perspective;
      if (item.tween && progressTime >= 0) {
        if (!item.onStart.only) {
          item.onStart();
          item.onStart.only = true;
        }
        item.onUpdate(easingTypes[item.ease](progressTime, 0, 1, item.duration));
        // 生成start
        for (let p in item.tween) {
          if (p !== 'start') {
            const _value = item.tween[p];
            const cssName = Css.isTransform(p);
            this.tweenStart[i] = this.tweenStart[i] || {};
            this.tweenStart[i][p] = this.tweenStart[i][p] || this.computedStyle[p] || 0;
            if (cssName === 'transform') {
              if (!this.tweenStart.oneBool) {
                // 第一次进入用style
                const transform = {};
                let array;
                if (this.props.style && this.props.style[cssName]) {
                  this.props.style[cssName].split(' ').forEach(item=> {
                    array = item.replace(/[(|)]/ig, ',').split(',');
                    transform[array[0]] = array[1];
                  });
                  this.tweenStart[i][p] = transform[p] || 0;
                } else if (this.style && this.style[cssName]) {
                  this.style[cssName].split(' ').forEach(item=> {
                    array = item.replace(/[(|)]/ig, ',').split(',');
                    transform[array[0]] = array[1];
                  });
                  this.tweenStart[i][p] = transform[p] || this.tweenStart[i][p];
                }
                this.tweenStart.oneBool = true;
              }

              if (this.tweenStart.end && !this.tweenStart.end[p + 'Bool' + i]) {
                this.tweenStart[i][p] = this.tweenStart.end[p] || 0;
                if (typeof this.tweenStart[i][p] === 'string') {
                  const startString = this.tweenStart[i][p];
                  const startArr = startString.replace(/[(|)]/ig, ',').split(',');
                  this.tweenStart[i][p] = startArr[1];
                }
                this.tweenStart.end[p + 'Bool' + i] = true;
              }
            }

            startData = this.tweenStart[i][p];
            end = DataToArray(parseFloat(item.tween[p]));
            let easeValue = [];
            if (cssName.indexOf('color') >= 0 || cssName.indexOf('Color') >= 0) {
              start = Css.parseColor(startData);
              end = Css.parseColor(_value);
              start[3] = start[3] || 1;
              end[3] = end[3] || 1;
            } else if (cssName.indexOf('shadow') >= 0 || cssName.indexOf('Shadow') >= 0) {
              startData = startData === 'none' ? '0 0 0 transparent' : startData;
              start = Css.parseShadow(startData);
              end = Css.parseShadow(_value);
            } else {
              start = DataToArray(parseFloat(this.tweenStart[i][p]));
            }

            //转成Array可对多个操作；
            start.forEach((startItem, i)=> {
              const endItem = end [i];
              easeValue[i] = easingTypes[item.ease](progressTime, parseFloat(startItem), parseFloat(endItem), item.duration);
              if (item.yoyo && !(item.repeatAnnal % 2)) {
                easeValue[i] = easingTypes[item.ease](progressTime, parseFloat(endItem), parseFloat(startItem), item.duration);
              }
            });
            easeValue = item.duration === 0 ? end : easeValue;
            this.tweenStart.end = this.tweenStart.end || {};
            this.tweenStart.end[p] = easeValue;
            if (cssName === 'transform') {
              matrixBool = true;
              const m = this.computedStyle[cssName].replace(/matrix|3d|[(|)]/ig, '').split(',').map(item=> {
                return parseFloat(item)
              });
              perspective = m[11] ? Math.round((m[10] < 0 ? -m[10] : m[10]) / (m[11] < 0 ? -m[11] : m[11])) : 0;
              matrixObj[p] = Css.getParam(p, _value, easeValue);
              this.tweenStart.end[p] = Css.getParam(p, _value, easeValue);
              //matrixObj[p] = easeValue;
              //this.tweenStart[cssName + i] = this.tweenStart[cssName + i] || this.computedStyle[cssName];
            } else {
              newStyle[cssName] = Css.getParam(p, _value, easeValue);
            }
          }
        }
        if (matrixBool) {
          let str = perspective ? 'perspective(' + perspective + 'px)' : '';
          for (let p in this.tweenStart.end) {
            if (Css.isTransform(p) === 'transform') {
              str += ' ' + this.tweenStart.end[p];
            }
          }
          for (let p in matrixObj) {
            str = Css.mergeTransform(str, matrixObj[p]);
          }
          newStyle['transform'] = str;
          /*let currentMatrix = Css.createMatrix(this.tweenStart['transform' + i]);
           let newMatrix = Css.createMatrix();
           for (let p in matrixObj) {
           if (p !== 'start' && p.indexOf('Unit') == -1) {
           newMatrix = Css.getTransformData(newMatrix, p, parseFloat(matrixObj[p].join()) - parseFloat(DataToArray(this.tweenStart[i][p]).join()), matrixObj[p + 'Unit']);
           }
           }
           currentMatrix = currentMatrix.multiply(newMatrix);
           newStyle['transform'] = currentMatrix.toString();*/
        }
      }

      if (progressTime === item.duration) {
        if (item.repeat && item.repeatAnnal !== item.repeat) {
          item.repeatAnnal++;
          item.initTime = item.initTime + item.duration + item.repeatDelay;
          item.onRepeat();
          this.componentWillUnmount();
        } else {

          this.defaultData[i] = null;
          if (!item.onComplete.only) {
            item.onComplete();
            item.onComplete.only = true;
          }
        }
      }
    });
    this.setState({
      style: newStyle
    });
    if (this.defaultData.every(c=>!c)) {
      this.componentWillUnmount();
    } else {
      this.rafID = requestAnimationFrame(this.raf);
    }
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.vars !== nextProps.vars) {
      // 数组情况不全等；
      if (Array.isArray(this.props.vars) && Array.isArray(nextProps.vars)) {
        let equalBool = true;
        for (let i = 0; i < this.props.vars.length; i++) {
          const currentObj = this.props.vars[i];
          const nextObj = nextProps.vars[i];
          for (let p in currentObj) {
            if (currentObj[p] !== nextObj[p]) {
              equalBool = false;
              break;
            }
          }
          if (!equalBool) {
            this.setDefaultData(nextProps.vars || {});
            this.componentWillUnmount();
            this.rafID = requestAnimationFrame(this.raf);
            break;
          }
        }
      } else {
        this.setDefaultData(nextProps.vars || {});
        this.componentWillUnmount();
        this.rafID = requestAnimationFrame(this.raf);
      }
    }
  }

  componentDidMount() {
    const dom = ReactDom.findDOMNode(this);
    this.computedStyle = document.defaultView.getComputedStyle(dom);
    if (this.computedStyle['transform'])
      if (this.defaultData.length) {
        this.rafID = requestAnimationFrame(this.raf);
      }
  }

  componentWillUnmount() {
    requestAnimationFrame.cancel(this._rafID);
    this._rafID = -1;
  }

  render() {
    const style = assign({}, this.props.style, this.state.style);
    return React.createElement(this.props.component, {style: style}, this.props.children);
  }
}

const objectOrArray = React.PropTypes.oneOfType([React.PropTypes.object, React.PropTypes.array]);

TweenOne.propTypes = {
  component: PropTypes.string,
  vars: objectOrArray,
};

TweenOne.defaultProps = {
  component: 'div',
  vars: null,
};
export default TweenOne;