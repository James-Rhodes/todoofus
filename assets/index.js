const todoTemplate = document.getElementById("todo-template");
const todoFormTemplate = document.getElementById("todo-form-template");
const todoEditFormTemplate = document.getElementById("todo-edit-form-template");

window.addEventListener("load", async () => {
  let todos;
  try {
    const response = await fetch("/todos");
    todos = await response.json();
  } catch (e) {
    console.error("Failed to create Todo item: ", e);
    return;
  }

  const todo_container = document.getElementById("all-todos");
  for (const todo of todos) {
    const todoElement = createTodoElement(
      todo.id,
      todo.description,
      todo.completed,
      todo.children,
    );

    todo_container.appendChild(todoElement);
  }
  adjustLineHeights();
});

// Places the form immediately after the refNode
function newTodoForm(refNode) {
  let parentId = "";
  if (refNode.id != "dummy-first-todo") {
    parentId = refNode.querySelector("input[name='id']").value;
  }

  const template = todoFormTemplate.content.cloneNode(true);
  template.querySelector("input[name='parent_id']").value = parentId;
  refNode.after(template);
  const descriptionInput = refNode.nextElementSibling.querySelector(
    "input[name='description']",
  );
  descriptionInput.focus(); // Focus for immediate typing
}

function removeTodoForm(formElement) {
  formElement.remove();
  adjustLineHeights();
}

function createTodoElement(id, todoDescription, todoCompleted, childTodos) {
  const newTodo = document.createElement("ul");

  const listItem = document.createElement("li");
  listItem.appendChild(todoTemplate.content.cloneNode(true));
  newTodo.appendChild(listItem);

  newTodo.querySelector(".todo-description").innerHTML =
    markdownLinksToHtml(todoDescription);

  newTodo.querySelector("input[name='id']").value = id;
  newTodo.querySelector(".todo-checkbox").checked = todoCompleted;

  for (child of childTodos) {
    newTodo.appendChild(
      createTodoElement(
        child.id,
        child.description,
        child.completed,
        child.children,
      ),
    );
  }

  return newTodo;
}

async function createTodo(event) {
  event.preventDefault();

  const submittedForm = event.target;
  let parentId = parseInt(
    submittedForm.querySelector("input[name='parent_id']").value,
  );
  parentId = isNaN(parentId) ? undefined : parentId; // If the value is empty then set it to undefined

  const todoDescription = submittedForm.querySelector(
    ".todo-description-input",
  ).value;

  let newTodoId = undefined;
  try {
    const response = await fetch("/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: todoDescription,
        parentId: parentId,
      }),
    });

    const json_resp = await response.json();
    newTodoId = json_resp.id;
    console.log("Created new Todo with ID: ", newTodoId);
  } catch (e) {
    console.error("Failed to create Todo item: ", e);
    return;
  }

  const newTodo = createTodoElement(newTodoId, todoDescription, false, []);
  submittedForm.closest(".todo-form").replaceWith(newTodo);

  adjustLineHeights();
}

function getChildrenTodoItems(parentTodo) {
  const parentUL = parentTodo.parentElement.parentElement; // The todo item is in a li, which must also be in a ul
  return parentUL.querySelectorAll(".todo-item");
}

async function toggleTodoItemRecursively(parentTodo) {
  const checked = parentTodo.querySelector(".todo-checkbox").checked;
  const childTodos = getChildrenTodoItems(parentTodo);

  const todoToUpdate = [];
  for (const child of childTodos) {
    todoToUpdate.push({
      id: parseInt(child.querySelector("input[name='id']").value),
      completed: checked,
    });
  }

  try {
    const response = await fetch("/todos/completed", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(todoToUpdate),
    });
    if (!response.ok) {
      throw `server responded ${response.status}: ${response.statusText}`;
    }
    console.log("Updated todos with", todoToUpdate);
  } catch (e) {
    console.error("Failed to update Todo items: ", e);
    return;
  }

  for (const child of childTodos) {
    child.querySelector(".todo-checkbox").checked = checked;
  }
}

function newEditTodoForm(todoElement) {
  const editForm = todoEditFormTemplate.content.cloneNode(true);

  const todoDescription = htmlLinksToMarkdown(
    todoElement.querySelector(".todo-description").innerHTML,
  );
  const todoID = todoElement.querySelector("input[name='id']").value;

  const descriptionInput = editForm.querySelector("input[name='description']");
  descriptionInput.value = todoDescription;
  editForm.querySelector("input[name='id']").value = todoID;

  todoElement.replaceWith(editForm);
  // Focus the description input and move cursor to the end
  descriptionInput.focus();
  if (descriptionInput.setSelectionRange) {
    const length = descriptionInput.value.length;
    descriptionInput.setSelectionRange(length, length);
  }
}

async function editTodo(event) {
  event.preventDefault();

  const submittedForm = event.target;

  const newDescription = submittedForm.querySelector(
    "input[name='description']",
  ).value;

  const todoID = parseInt(
    submittedForm.querySelector("input[name='id']").value,
  );

  // Send to DB
  try {
    const response = await fetch("/todos/description", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: todoID, description: newDescription }),
    });
    if (!response.ok) {
      throw `server responded ${response.status}: ${response.statusText}`;
    }
    console.log(
      `Updated todo ${todoID} with new description ${newDescription}`,
    );
  } catch (e) {
    console.error("Failed to update Todo description: ", e);
    return;
  }

  // Update DOM
  const newTodo = todoTemplate.content.cloneNode(true);
  const newTodoItem = newTodo.querySelector(".todo-item");
  newTodoItem.querySelector(".todo-description").innerHTML =
    markdownLinksToHtml(newDescription);
  newTodoItem.querySelector("input[name='id']").value = todoID;

  submittedForm.replaceWith(newTodoItem);

  adjustLineHeights();
}

async function deleteTodo(todoItem) {
  if (!confirm("Are you sure?")) {
    return;
  }

  const todoID = parseInt(todoItem.querySelector("input[name='id']").value);

  // Send to DB
  try {
    const response = await fetch("/todos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: todoID }),
    });
    if (!response.ok) {
      throw `server responded ${response.status}: ${response.statusText}`;
    }
    console.log(`Deleted todo ${todoID}`);
  } catch (e) {
    console.error("Failed to delete Todo: ", e);
    return;
  }

  // Update DOM
  const treeUL = todoItem.parentElement.parentElement;
  treeUL.remove();

  adjustLineHeights();
}

function adjustLineHeights() {
  const lis = document.querySelectorAll("ul ul li");
  for (const curr of lis) {
    const sibCheckbox =
      curr.parentElement.previousElementSibling.querySelector(".todo-checkbox");
    if (sibCheckbox == null) {
      continue;
    }

    const currRect = curr.getBoundingClientRect();
    const currY = currRect.top + currRect.height / 2;
    const currHeight = currRect.height;

    const sibRect = sibCheckbox.getBoundingClientRect();

    const lineHeight = currY - sibRect.top - 5;

    curr.style.setProperty("--line-height", `${lineHeight}px`);
    curr.style.setProperty("--top-shift", `-${lineHeight - currHeight / 2}px`);
  }
}

function markdownLinksToHtml(text) {
  return text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );
}
function htmlLinksToMarkdown(html) {
  return html.replace(/<a\s+href="([^"]+)"[^>]*>(.*?)<\/a>/g, "[$2]($1)");
}

// TODO: checked nodes sorted to the bottom of the ul they are in, when unchecked move them back into the unchecked section
