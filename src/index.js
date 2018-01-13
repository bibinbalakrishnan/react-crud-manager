import React, { PureComponent, Component } from "react";

const disabled_style = { pointerEvents: "none", opacity: 0.4 };

export const CrudAction = Object.freeze({
  ADD: Symbol("add"),
  BEFORE_UPDATE: Symbol("before_update"),
  UPDATE: Symbol("update"),
  BEFORE_DELETE: Symbol("before_delete"),
  DELETE: Symbol("delete")
});
class EditableRenderer extends Component {
  constructor(props) {
    super(props);
    this.editCtrls = [
      this.props.saveCtrl({ onClick: this.handleSave, key: "save_ctrl" }),
      this.props.cancelCtrl({ onClick: this.handleCancel, key: "cancel_ctrl" })
    ];
    this.state = Object.assign({}, this.props.data);
  }

  handleSave = () => {
    this.props.onSave(this.state);
  };

  handleCancel = () => {
    this.props.onCancel();
  };
  handleChange = ({ target }, property) => {
    this.setState({ [property]: target.value });
  };

  render() {
    return this.props.renderFn({
      row: this.state,
      onChange: this.handleChange,
      controls: this.editCtrls
    });
  }
}

class ReadOnlyRenderer extends Component {
  constructor(props) {
    super(props);
    this.ctrls = [
      this.props.editCtrl({
        onClick: () => this.editRecord(),
        key: "edit_" + this.props.id
      }),
      this.props.delCtrl({
        onClick: () => this.deleteRecord(),
        key: "del_" + this.props.id
      })
    ];
  }

  editRecord = () => {
    this.props.onEdit(this.props.id);
  };

  deleteRecord = () => {
    this.props.onDelete(this.props.id);
  };

  shouldComponentUpdate(nextProps) {
    return this.props.data !== nextProps.data;
  }

  render() {
    return this.props.renderFn({
      row: this.props.data,
      controls: this.ctrls
    });
  }
}
class AddCtrl extends Component {
  constructor(props) {
    super(props);
    this.ctrl = this.props.renderFn({
      onClick: this.props.onClick,
      key: "add_ctrl"
    });
    this.disabled = <div style={disabled_style}>{this.ctrl}</div>;
  }

  shouldComponentUpdate(nextProps) {
    return this.props.disabled !== nextProps.disabled;
  }
  render() {
    if (this.props.disabled) {
      return this.disabled;
    } else {
      return this.ctrl;
    }
  }
}

export default class CrudManager extends Component {
  constructor(props) {
    super(props);
    this.state = { data: [], editMode: false, errors: null };
    this.getData = this.getData.bind(this);
  }

  componentDidMount(){
    this.setState({data : this.props.data})
  }
  componentWillReceiveProps(nextProps) {
    console.log("Recieving props")
    if (this.props.data !== nextProps.data) {
      this.setState({ data: [...nextProps.data] });
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    return (
      this.props.data !== nextProps.data ||
      this.state.editMode !== nextState.editMode ||
      this.state.errors !== nextState.errors ||
      this.state.data !== nextState.data ||
      this.state.editIndex !== nextState.editIndex
    );
  }

  getData() {
    return this.state.data;
  }

  notifyListener = (action, before, after) => {
    if (this.props.listener) {
      const { data } = this.state;
      const { id } = this.props;
      return this.props.listener({ id, action, before, after, data });
    }
  };
  addRecord = () => {
    this.setState({ editMode: true, editIndex: -1 });
  };
  editRecord = id => {
    this.setState({ editMode: true, editIndex: id });
  };
  deleteRecord = id => {
    const { data } = this.state;
    const target = data[id];
    const shouldDelete = this.notifyListener(
      CrudAction.BEFORE_DELETE,
      target,
      target
    );
    if (typeof shouldDelete === "string") {
      this.setState({ errors: [shouldDelete] });
      return;
    }
    this.setState(
      {
        data: [...data.slice(0, id), ...data.slice(id + 1, data.length)]
      },
      () => this.notifyListener(CrudAction.DELETE, target, null)
    );
  };

  saveRecord = editData => {
    const errors = [];
    const { "data-id": key, validator } = this.props;
    if (key) {
      if (
        this.state.data.find(
          (row, idx) =>
            idx != this.state.editIndex && row[key] === editData[key]
        )
      ) {
        errors.push(`Unique identifier ${editData[key]} already exists`);
      }
    }
    if (validator) {
      validator(editData, errors);
    }
    if (errors.length === 0) {
      const { editIndex, data } = this.state;
      if (editIndex === -1) {
        this.setState(
          { editMode: false, errors: null, data: [...data, editData] },
          () => this.notifyListener(CrudAction.ADD, null, editData)
        );
      } else if (editIndex > -1) {
        const before = data[editIndex];
        const shouldUpdate = this.notifyListener(
          CrudAction.BEFORE_UPDATE,
          before,
          editData
        );
        if (typeof shouldUpdate === "string") {
          this.setState({ errors: [shouldUpdate] });
          return;
        }
        this.setState(
          {
            editMode: false,
            errors: null,
            data: data.map((row, index) => {
              if (index !== editIndex) {
                return row;
              }
              return editData;
            })
          },
          () =>
            this.notifyListener(
              CrudAction.UPDATE,
              before,
              this.state.data[editIndex]
            )
        );
      }
    } else {
      this.setState({ errors });
    }
  };
  cancelEdit = () => {
    this.setState({ editMode: false, errors: null });
  };

  renderEditable = data => {
    return (
      <EditableRenderer
        key={"edit_renderer_" + this.state.editIndex}
        data={data}
        renderFn={this.props.renderEditable}
        saveCtrl={this.props.renderSaveCtrl}
        cancelCtrl={this.props.renderCancelCtrl}
        index={this.state.editIndex}
        onCancel={this.cancelEdit}
        onSave={this.saveRecord}
      />
    );
  };

  render() {
    const {
      renderDeleteCtrl,
      renderEditCtrl,
      renderReadOnly,
      renderAddCtrl,
      renderEditable,
      renderGrid,
      mode = "inline"
    } = this.props;
    const { data, editMode, editIndex, errors } = this.state;
    const showAddCtrl =
      ((!data || data.length === 0) && !this.state.editMode) ||
      !this.state.editMode;
    const addCtrl = (
      <AddCtrl
        renderFn={renderAddCtrl}
        onClick={this.addRecord}
        disabled={!showAddCtrl}
      />
    );
    const view = { grid: [] };
    if (data.length > 0) {
      data.forEach((row, key) => {
        if (editMode && key === editIndex) {
          if (mode === "split") {
            view.editor = this.renderEditable(row);
          } else {
            view.grid.push(this.renderEditable(row));
          }
        } else {
          view.grid.push(
            <ReadOnlyRenderer
              renderFn={renderReadOnly}
              key={key}
              id={key}
              data={row}
              editCtrl={renderEditCtrl}
              delCtrl={renderDeleteCtrl}
              onEdit={this.editRecord}
              onDelete={this.deleteRecord}
            />
          );
        }
      });
    }
    if (editMode && editIndex === -1) {
      if (mode === "split") {
        view.editor = this.renderEditable(this.props.factory());
      } else {
        view.grid.push(this.renderEditable(this.props.factory()));
      }
    }
    return renderGrid({ addCtrl, view, errors });
  }
}

