const todoTemplate = document.getElementById("todo-template");
const todoFormTemplate = document.getElementById("todo-form-template");

// Places the form immediately after the refNode
function newTodoForm(refNode) {
  const template = todoFormTemplate.content.cloneNode(true);
  refNode.after(template);
}

function removeTodoForm(formElement) {
  formElement.remove();
}

function createTodo(event) {
  event.preventDefault();

  const submittedForm = event.target;

  const newTodo = document.createElement("ul");
  const listItem = document.createElement("li");

  listItem.appendChild(todoTemplate.content.cloneNode(true));
  const todoDescription = submittedForm.querySelector(
    ".todo-description-input",
  ).value;
  newTodo.appendChild(listItem);

  // TODO: Actually send this to the DB

  newTodo.querySelector(".todo-description").textContent = todoDescription;

  submittedForm.closest(".todo-form").replaceWith(newTodo);
}

function getChildrenTodoItems(parentTodo) {
  const parentUL = parentTodo.parentElement.parentElement; // The todo item is in a li, which must also be in a ul
  return parentUL.querySelectorAll(".todo-item");
}

// TODO: On check of a todo, recursively check all of its children todos
// TODO: On uncheck of a todo, recursively uncheck all of its children todos
function toggleTodoItemRecursively(parentTodo) {
  const checked = parentTodo.querySelector(".todo-checkbox").checked;
  const childTodos = getChildrenTodoItems(parentTodo);

  // TODO: Actually send this to the DB
  for (const child of childTodos) {
    child.querySelector(".todo-checkbox").checked = checked;
  }
}

// TODO: checked nodes sorted to the bottom of the ul they are in, when unchecked move them back into the unchecked section
// TODO: Server should show all todo's from the last X days. Even if they are completed. So they can be unticked as necessary
